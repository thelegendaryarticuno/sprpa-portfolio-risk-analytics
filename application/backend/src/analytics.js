// Portfolio analytics (SDD 4.4 formulas). Pure functions, no I/O.
// shortcut: runs in the Node service synchronously instead of a Python worker behind a queue;
// move to the FastAPI engine + BullMQ if jobs exceed a few seconds.

const TD = 252;
const Z = { 0.9: 1.2816, 0.95: 1.645, 0.99: 2.326 };
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
export const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
export const cov = (a, b) => {
  const ma = mean(a), mb = mean(b);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
  return s / (a.length - 1);
};
const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))];
const rets = (v) => v.slice(1).map((x, i) => x / v[i] - 1);

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const normal = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

function cholesky(m) {
  const n = m.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = m[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
  return L;
}

// Align every series to the benchmark calendar, forward/back filling gaps (max gap policy is the caller's job).
function align(calendar, h) {
  const map = new Map(h.dates.map((d, i) => [d, h.closes[i]]));
  let last = h.closes[0];
  return calendar.map((d) => {
    if (map.has(d)) last = map.get(d);
    return last;
  });
}

export function analyze({ holdings, histories, bench, days = 252, conf = 0.95, horizon = 1, sims = 5000, seed = 42, rf = 0.065, shocks = [-0.05, -0.1, -0.2, -0.3] }) {
  if (!holdings.length) return { empty: true };
  const cal = bench.dates.slice(-(days + 1));
  const px = holdings.map((h) => align(cal, histories[h.symbol]));
  const n = cal.length;
  const value = cal.map((_, t) => holdings.reduce((s, h, i) => s + h.qty * px[i][t], 0));
  const b = align(cal, bench);
  const r = rets(value), br = rets(b);
  const V = value[n - 1];
  const w = holdings.map((h, i) => (h.qty * px[i][n - 1]) / V);
  const assetR = px.map(rets);

  const total = value[n - 1] / value[0] - 1;
  const years = r.length / TD;
  const ann = (1 + total) ** (1 / years) - 1;
  const vol = std(r) * Math.sqrt(TD);
  const rfd = rf / TD;
  const sharpe = ((mean(r) - rfd) / (std(r) || 1)) * Math.sqrt(TD);
  const down = Math.sqrt(mean(r.map((x) => Math.min(x - rfd, 0) ** 2)));
  const sortino = ((mean(r) - rfd) / (down || 1)) * Math.sqrt(TD);
  const beta = cov(r, br) / (cov(br, br) || 1);
  const benchTotal = b[n - 1] / b[0] - 1;
  const benchAnn = (1 + benchTotal) ** (1 / years) - 1;
  const alpha = ann - (rf + beta * (benchAnn - rf));

  // drawdown + rolling vol + normalised performance
  let peak = value[0], maxDD = 0;
  const drawdown = value.map((v, i) => {
    peak = Math.max(peak, v);
    const dd = v / peak - 1;
    maxDD = Math.min(maxDD, dd);
    return { date: cal[i], dd: +(dd * 100).toFixed(2) };
  });
  const rolling = r.map((_, i) => (i < 29 ? null : { date: cal[i + 1], vol: +(std(r.slice(i - 29, i + 1)) * Math.sqrt(TD) * 100).toFixed(2) })).filter(Boolean);
  const performance = cal.map((d, i) => ({ date: d, portfolio: +((value[i] / value[0]) * 100).toFixed(2), benchmark: +((b[i] / b[0]) * 100).toFixed(2) }));

  // VaR / CVaR
  const sorted = [...r].sort((a, c) => a - c);
  const hz = Math.sqrt(horizon);
  const q = quantile(sorted, 1 - conf);
  const tail = sorted.filter((x) => x <= q);
  const z = Z[conf] ?? 1.645;
  const var_ = {
    historical: -q * V * hz,
    parametric: (z * std(r) - mean(r)) * V * hz,
    cvar: -mean(tail) * V * hz,
  };

  // Monte Carlo (correlated via Cholesky of asset covariance, fixed seed => reproducible)
  const k = holdings.length;
  const mu = assetR.map(mean);
  const C = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => cov(assetR[i], assetR[j]) + (i === j ? 1e-10 : 0)));
  const L = cholesky(C);
  const rand = mulberry(seed);
  const paths = Array.from({ length: horizon + 1 }, () => []);
  const finals = [];
  for (let s = 0; s < sims; s++) {
    let g = 1;
    paths[0].push(0);
    for (let d = 1; d <= horizon; d++) {
      const zs = Array.from({ length: k }, () => normal(rand));
      let pr = 0;
      for (let i = 0; i < k; i++) {
        let sh = 0;
        for (let j = 0; j <= i; j++) sh += L[i][j] * zs[j];
        pr += w[i] * (mu[i] + sh);
      }
      g *= 1 + pr;
      paths[d].push((g - 1) * 100);
    }
    finals.push((g - 1) * 100);
  }
  const fan = paths.map((p, d) => {
    const s = [...p].sort((a, c) => a - c);
    return { day: d, p5: +quantile(s, 0.05).toFixed(2), p25: +quantile(s, 0.25).toFixed(2), p50: +quantile(s, 0.5).toFixed(2), p75: +quantile(s, 0.75).toFixed(2), p95: +quantile(s, 0.95).toFixed(2) };
  });
  const fs = [...finals].sort((a, c) => a - c);
  const mcQ = quantile(fs, 1 - conf);
  const lo = fs[0], hi = fs.at(-1), bins = 28, step = (hi - lo) / bins || 1;
  const hist = Array.from({ length: bins }, (_, i) => ({ x: +(lo + step * (i + 0.5)).toFixed(2), n: 0 }));
  finals.forEach((f) => hist[Math.min(bins - 1, Math.floor((f - lo) / step))].n++);
  const monteCarlo = {
    sims, horizon, seed, fan, hist,
    var: -(mcQ / 100) * V,
    cvar: -(mean(fs.filter((x) => x <= mcQ)) / 100) * V,
    expectedReturnPct: mean(finals),
    probLossPct: (finals.filter((x) => x < 0).length / sims) * 100,
  };

  // Per-asset stats, correlation, contribution
  const assets = holdings.map((h, i) => {
    const ar = assetR[i];
    return {
      symbol: h.symbol, weight: w[i], value: h.qty * px[i][n - 1], price: px[i][n - 1],
      return: px[i][n - 1] / px[i][0] - 1,
      vol: std(ar) * Math.sqrt(TD),
      beta: cov(ar, br) / (cov(br, br) || 1),
      contribution: w[i] * (px[i][n - 1] / px[i][0] - 1),
    };
  });
  const corr = {
    symbols: holdings.map((h) => h.symbol),
    matrix: C.map((row, i) => row.map((c, j) => +(c / Math.sqrt(C[i][i] * C[j][j])).toFixed(2))),
  };

  // Stress test (SDD): new value = sum w * (1 + shock * beta)
  const stress = shocks.map((s) => {
    const impact = assets.reduce((a, x) => a + x.weight * s * x.beta, 0);
    return { shock: s, impactPct: impact * 100, loss: impact * V };
  });

  // Efficient frontier via random long-only portfolios (sum 1, no shorting)
  const aMu = mu.map((m) => m * TD);
  const aC = C.map((row) => row.map((c) => c * TD));
  const fr = mulberry(seed + 7);
  const pts = [];
  for (let s = 0; s < 2000; s++) {
    let ws = Array.from({ length: k }, () => -Math.log(fr() || 1e-9));
    const tot = ws.reduce((a, x) => a + x, 0);
    ws = ws.map((x) => x / tot);
    const er = ws.reduce((a, x, i) => a + x * aMu[i], 0);
    const v2 = ws.reduce((a, x, i) => a + x * ws.reduce((b2, y, j) => b2 + y * aC[i][j], 0), 0);
    const v = Math.sqrt(v2);
    pts.push({ vol: v * 100, ret: er * 100, sharpe: (er - rf) / v, w: ws });
  }
  const best = pts.reduce((a, p) => (p.sharpe > a.sharpe ? p : a));
  const minV = pts.reduce((a, p) => (p.vol < a.vol ? p : a));
  const wmap = (p) => holdings.map((h, i) => ({ symbol: h.symbol, weight: p.w[i] }));
  const frontier = {
    points: pts.filter((_, i) => i % 4 === 0).map((p) => ({ vol: +p.vol.toFixed(2), ret: +p.ret.toFixed(2), sharpe: +p.sharpe.toFixed(2) })),
    current: { vol: vol * 100, ret: aMu.reduce((a, m, i) => a + w[i] * m, 0) * 100 },
    maxSharpe: { vol: best.vol, ret: best.ret, sharpe: best.sharpe, weights: wmap(best) },
    minVol: { vol: minV.vol, ret: minV.ret, sharpe: minV.sharpe, weights: wmap(minV) },
  };

  return {
    asOf: cal[n - 1], days: r.length, value: V, startValue: value[0],
    metrics: { totalReturn: total, annReturn: ann, vol, sharpe, sortino, beta, alpha, maxDrawdown: maxDD, benchTotal, benchAnn, var: var_, conf, horizon },
    performance, drawdown, rolling, assets, corr, stress, monteCarlo, frontier,
  };
}

// Holdings from transactions: net quantity + weighted-average cost of buys.
export function holdingsFrom(txs) {
  const m = new Map();
  for (const t of txs) {
    const h = m.get(t.symbol) || { symbol: t.symbol, qty: 0, cost: 0, buyQty: 0 };
    const q = Number(t.quantity), p = Number(t.price);
    if (t.type === "BUY") { h.qty += q; h.cost += q * p + Number(t.fees || 0); h.buyQty += q; }
    else h.qty -= q;
    m.set(t.symbol, h);
  }
  return [...m.values()].filter((h) => h.qty > 1e-9).map((h) => ({ symbol: h.symbol, qty: h.qty, avgCost: h.buyQty ? h.cost / h.buyQty : 0 }));
}
