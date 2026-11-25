import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { parse } from "csv-parse/sync";
import { pool, initDb } from "./db.js";
import { requireAuth, audit } from "./auth.js";
import { getHistory, getQuote, normalizeSymbol, UNIVERSE, BENCH } from "./market.js";
import { analyze, holdingsFrom } from "./analytics.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "100kb" }));
app.use(express.text({ type: "text/csv", limit: "2mb" })); // SDD: CSV max 2 MB
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

const err = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); err(res, 500, "INTERNAL", "Something went wrong"); });
const UUID = /^[0-9a-f-]{36}$/i;

app.get("/api/health", (_q, res) => res.json({ status: "ok" }));
app.get("/api/ready", wrap(async (_q, res) => { await pool.query("SELECT 1"); res.json({ status: "ready" }); }));

// ---- market (auth'd to protect provider quota)
app.get("/api/market/search", requireAuth, (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  res.json(UNIVERSE.filter((u) => u[0].toLowerCase().includes(q) || u[1].toLowerCase().includes(q)).slice(0, 8)
    .map(([symbol, name, sector]) => ({ symbol, name, sector })));
});
app.get("/api/market/quotes", requireAuth, wrap(async (req, res) => {
  const syms = String(req.query.symbols || "").split(",").map(normalizeSymbol).filter(Boolean).slice(0, 20);
  res.json(await Promise.all(syms.map(getQuote)));
}));

app.get("/api/me", requireAuth, (req, res) => res.json(req.user));

// ---- portfolios
async function owned(req, res) {
  if (!UUID.test(req.params.id)) { err(res, 404, "NOT_FOUND", "Portfolio not found"); return null; }
  const { rows } = await pool.query("SELECT * FROM portfolios WHERE id=$1 AND uid=$2", [req.params.id, req.uid]);
  if (!rows[0]) { err(res, 404, "NOT_FOUND", "Portfolio not found"); return null; } // 404 not 403: don't leak existence (IDOR)
  return rows[0];
}

app.get("/api/portfolios", requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id,p.name,p.is_demo,p.created_at,
       (SELECT count(*) FROM transactions t WHERE t.portfolio_id=p.id)::int AS tx_count
     FROM portfolios p WHERE uid=$1 ORDER BY created_at`, [req.uid]);
  res.json(rows);
}));

app.post("/api/portfolios", requireAuth, wrap(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (name.length < 1 || name.length > 60) return err(res, 400, "VALIDATION_ERROR", "name must be 1-60 characters");
  const { rows } = await pool.query("INSERT INTO portfolios(uid,name) VALUES($1,$2) RETURNING id,name,is_demo", [req.uid, name]);
  audit(req, "portfolio.create", rows[0].id);
  res.status(201).json(rows[0]);
}));

app.post("/api/portfolios/demo", requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query("INSERT INTO portfolios(uid,name,is_demo) VALUES($1,'Demo Portfolio (sample holdings)',true) RETURNING id,name,is_demo", [req.uid]);
  const id = rows[0].id;
  const seed = [["RELIANCE.NS", 40], ["TCS.NS", 20], ["HDFCBANK.NS", 60], ["INFY.NS", 50], ["ITC.NS", 200], ["SBIN.NS", 80], ["SUNPHARMA.NS", 35], ["TITAN.NS", 18]];
  const date = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  for (const [symbol, qty] of seed) {
    const h = await getHistory(symbol);
    const price = h.closes[Math.max(0, h.closes.length - 300)];
    await pool.query("INSERT INTO transactions(portfolio_id,symbol,type,quantity,price,trade_date) VALUES($1,$2,'BUY',$3,$4,$5)", [id, symbol, qty, price, date]);
  }
  res.status(201).json(rows[0]);
}));

app.delete("/api/portfolios/:id", requireAuth, wrap(async (req, res) => {
  const p = await owned(req, res); if (!p) return;
  await pool.query("DELETE FROM portfolios WHERE id=$1", [p.id]);
  audit(req, "portfolio.delete", p.id);
  res.status(204).end();
}));

// ---- transactions
function validTx(b) {
  const symbol = normalizeSymbol(b.symbol);
  const type = String(b.type || "").toUpperCase();
  const quantity = Number(b.quantity), price = Number(b.price), fees = Number(b.fees || 0);
  const date = String(b.trade_date || "");
  if (!symbol) return "invalid symbol";
  if (!["BUY", "SELL"].includes(type)) return "type must be BUY or SELL";
  if (!(quantity > 0)) return "quantity must be positive";
  if (!(price >= 0) || !(fees >= 0)) return "price and fees must be non-negative";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || Date.parse(date) > Date.now()) return "trade_date must be a past YYYY-MM-DD date";
  return { symbol, type, quantity, price, fees, date };
}

app.get("/api/portfolios/:id/transactions", requireAuth, wrap(async (req, res) => {
  const p = await owned(req, res); if (!p) return;
  const { rows } = await pool.query("SELECT id,symbol,type,quantity::float,price::float,fees::float,trade_date FROM transactions WHERE portfolio_id=$1 ORDER BY trade_date DESC, created_at DESC", [p.id]);
  res.json(rows);
}));

// Rejects a SELL that would take a position negative (SRS: negative quantities unsupported).
async function sellOk(portfolioId, tx) {
  if (tx.type !== "SELL") return true;
  const { rows } = await pool.query("SELECT symbol,type,quantity,price,fees FROM transactions WHERE portfolio_id=$1 AND symbol=$2", [portfolioId, tx.symbol]);
  const h = holdingsFrom(rows)[0];
  return (h?.qty || 0) >= tx.quantity;
}

app.post("/api/portfolios/:id/transactions", requireAuth, wrap(async (req, res) => {
  const p = await owned(req, res); if (!p) return;
  const t = validTx(req.body || {});
  if (typeof t === "string") return err(res, 400, "VALIDATION_ERROR", t);
  if (!(await sellOk(p.id, t))) return err(res, 422, "INSUFFICIENT_HOLDING", `Cannot sell more ${t.symbol} than you hold`);
  const { rows } = await pool.query(
    "INSERT INTO transactions(portfolio_id,symbol,type,quantity,price,fees,trade_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [p.id, t.symbol, t.type, t.quantity, t.price, t.fees, t.date]);
  res.status(201).json(rows[0]);
}));

app.delete("/api/portfolios/:id/transactions/:tid", requireAuth, wrap(async (req, res) => {
  const p = await owned(req, res); if (!p) return;
  if (!UUID.test(req.params.tid)) return err(res, 404, "NOT_FOUND", "Transaction not found");
  await pool.query("DELETE FROM transactions WHERE id=$1 AND portfolio_id=$2", [req.params.tid, p.id]);
  res.status(204).end();
}));

// CSV: symbol,type,quantity,price,trade_date[,fees]. All-or-nothing per valid row set; errors reported per row.
app.post("/api/portfolios/:id/import", requireAuth, wrap(async (req, res) => {
  const p = await owned(req, res); if (!p) return;
  if (typeof req.body !== "string") return err(res, 415, "UNSUPPORTED", "Send the file as text/csv");
  let records;
  try { records = parse(req.body, { columns: (h) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true, bom: true }); }
  catch { return err(res, 422, "BAD_CSV", "Could not parse CSV"); }
  if (records.length > 5000) return err(res, 413, "TOO_LARGE", "Max 5000 rows");
  const errors = [], good = [];
  records.forEach((r, i) => {
    const t = validTx(r);
    typeof t === "string" ? errors.push({ row: i + 2, message: t }) : good.push(t);
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const t of good)
      await client.query("INSERT INTO transactions(portfolio_id,symbol,type,quantity,price,fees,trade_date) VALUES($1,$2,$3,$4,$5,$6,$7)", [p.id, t.symbol, t.type, t.quantity, t.price, t.fees, t.date]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  audit(req, "portfolio.import", p.id);
  res.json({ imported: good.length, errors });
}));

// ---- analytics
app.get("/api/portfolios/:id/analytics", requireAuth, wrap(async (req, res) => {
  const p = await owned(req, res); if (!p) return;
  const days = { "6m": 126, "1y": 252, "2y": 504 }[req.query.range] || 252;
  const conf = [0.9, 0.95, 0.99].includes(Number(req.query.conf)) ? Number(req.query.conf) : 0.95;
  const horizon = Math.min(30, Math.max(1, parseInt(req.query.horizon) || 1));
  const sims = Math.min(20000, Math.max(500, parseInt(req.query.sims) || 5000));
  const { rows: txs } = await pool.query("SELECT symbol,type,quantity,price,fees FROM transactions WHERE portfolio_id=$1", [p.id]);
  const hold = holdingsFrom(txs);
  if (!hold.length) return res.json({ empty: true });
  const symbols = hold.map((h) => h.symbol);
  const [bench, ...hs] = await Promise.all([getHistory(BENCH), ...symbols.map(getHistory)]);
  const histories = Object.fromEntries(symbols.map((s, i) => [s, hs[i]]));
  const short = symbols.filter((s) => histories[s].closes.length < 60);
  if (short.length) return err(res, 422, "INSUFFICIENT_HISTORY", `Not enough price history for ${short.join(", ")}`);
  const result = analyze({ holdings: hold, histories, bench, days, conf, horizon, sims, seed: parseInt(req.query.seed) || 42 });
  const sources = new Set([bench.source, ...hs.map((h) => h.source)]);
  const cost = hold.reduce((s, h) => s + h.qty * h.avgCost, 0);
  res.json({ ...result, invested: cost, pnl: result.value - cost, dataSource: sources.size === 1 ? [...sources][0] : "mixed", holdingsRaw: hold });
}));

app.use((_q, res) => err(res, 404, "NOT_FOUND", "Route not found"));

await initDb();
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`SP-RPA backend listening on :${port}`));
