import { useRef, useState } from "react";
import { Download, FileUp, Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { useAsync, usePortfolios } from "../state";
import { Badge, Button, ChartCard, Modal, Skeleton } from "../ui";
import { inr, short } from "../lib";

const SAMPLE = "symbol,type,quantity,price,trade_date,fees\nRELIANCE,BUY,10,2650.50,2025-03-12,20\nTCS,BUY,5,3900,2025-04-02,15\nINFY,BUY,25,1480,2025-05-20,18\nINFY,SELL,5,1720,2025-09-10,12\n";
const today = () => new Date().toISOString().slice(0, 10);

function AddTx({ open, onClose, pid, onDone }) {
  const [f, setF] = useState({ symbol: "", type: "BUY", quantity: "", price: "", fees: "0", trade_date: today() });
  const [sug, setSug] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.addTx(pid, f); onDone(); onClose(); setF({ ...f, symbol: "", quantity: "", price: "" }); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} title="Add transaction">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3.5">
        <div className="col-span-2">
          <label className="label" htmlFor="sym">Symbol (NSE)</label>
          <input id="sym" className="input" required list="syms" placeholder="e.g. RELIANCE or TCS" value={f.symbol} onChange={(e) => { set("symbol")(e); api.search(e.target.value).then(setSug).catch(() => {}); }} />
          <datalist id="syms">{sug.map((s) => <option key={s.symbol} value={short(s.symbol)}>{s.name}</option>)}</datalist>
        </div>
        <div><label className="label">Type</label><select className="input" value={f.type} onChange={set("type")}><option>BUY</option><option>SELL</option></select></div>
        <div><label className="label">Date</label><input className="input" type="date" required max={today()} value={f.trade_date} onChange={set("trade_date")} /></div>
        <div><label className="label">Quantity</label><input className="input" type="number" min="0" step="any" required value={f.quantity} onChange={set("quantity")} /></div>
        <div><label className="label">Price (₹)</label><input className="input" type="number" min="0" step="any" required value={f.price} onChange={set("price")} /></div>
        <div className="col-span-2"><label className="label">Fees (₹)</label><input className="input" type="number" min="0" step="any" value={f.fees} onChange={set("fees")} /></div>
        {err && <div role="alert" className="col-span-2 rounded-xl border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">{err}</div>}
        <Button className="col-span-2" size="lg" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Add transaction</Button>
      </form>
    </Modal>
  );
}

function ImportCsv({ open, onClose, pid, onDone }) {
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  const upload = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setErr("File exceeds the 2 MB limit.");
    setBusy(true); setErr(null); setRes(null);
    try { setRes(await api.importCsv(pid, await file.text())); onDone(); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const dl = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([SAMPLE], { type: "text/csv" })); a.download = "sprpa-sample.csv"; a.click(); };
  return (
    <Modal open={open} onClose={() => { setRes(null); setErr(null); onClose(); }} title="Import transactions from CSV">
      <div
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}
        onClick={() => ref.current.click()}
        className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-line bg-raised/40 px-6 py-10 text-center transition hover:border-brand/50 hover:bg-brand/5">
        {busy ? <Loader2 className="animate-spin text-brand" /> : <FileUp className="text-brand" />}
        <p className="mt-3 text-sm font-medium">Drop a CSV here or click to browse</p>
        <p className="mt-1 text-xs text-muted">Columns: symbol, type, quantity, price, trade_date, fees (optional) · max 2 MB</p>
        <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={(e) => upload(e.target.files[0])} />
      </div>
      <button onClick={dl} className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand hover:underline"><Download size={13} /> Download sample CSV</button>
      {err && <div role="alert" className="mt-4 rounded-xl border border-down/30 bg-down/10 px-3.5 py-2.5 text-sm text-down">{err}</div>}
      {res && (
        <div className="mt-4 space-y-2">
          <div className="rounded-xl border border-up/30 bg-up/10 px-3.5 py-2.5 text-sm text-up">Imported {res.imported} transaction{res.imported === 1 ? "" : "s"}.</div>
          {res.errors.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
              <div className="mb-1 font-medium">{res.errors.length} row{res.errors.length === 1 ? "" : "s"} skipped</div>
              {res.errors.map((e) => <div key={e.row}>Row {e.row}: {e.message}</div>)}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Portfolio() {
  const { selected, current, refresh } = usePortfolios();
  const tx = useAsync(() => api.transactions(selected), [selected]);
  const [add, setAdd] = useState(false);
  const [imp, setImp] = useState(false);
  const done = () => { tx.reload(); refresh(); };

  const delPortfolio = async () => {
    if (!window.confirm(`Delete "${current.name}" and all its transactions? This cannot be undone.`)) return;
    await api.deletePortfolio(selected); refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">{current?.name}</h1>{current?.is_demo && <Badge tone="warn">Sample holdings</Badge>}</div>
          <p className="mt-1 text-sm text-muted">Transactions are the source of truth; holdings are calculated from them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setImp(true)}><FileUp size={15} /> Import CSV</Button>
          <Button onClick={() => setAdd(true)}><Plus size={15} /> Add transaction</Button>
          <Button variant="danger" onClick={delPortfolio} aria-label="Delete portfolio"><Trash2 size={15} /></Button>
        </div>
      </div>

      <ChartCard title={`Transactions${tx.data ? ` · ${tx.data.length}` : ""}`}>
        {tx.loading && !tx.data ? <Skeleton className="h-48" /> : tx.data?.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No transactions yet. Add one, or import a CSV.</div>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead><tr><th className="th">Date</th><th className="th">Symbol</th><th className="th">Type</th><th className="th text-right">Qty</th><th className="th text-right">Price</th><th className="th text-right">Fees</th><th className="th" /></tr></thead>
              <tbody>
                {tx.data?.map((t) => (
                  <tr key={t.id} className="border-t border-line/60 hover:bg-raised/40">
                    <td className="td font-mono text-xs text-muted">{String(t.trade_date).slice(0, 10)}</td>
                    <td className="td font-medium">{short(t.symbol)}</td>
                    <td className="td"><span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${t.type === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>{t.type}</span></td>
                    <td className="td text-right font-mono">{t.quantity}</td>
                    <td className="td text-right font-mono">{inr(t.price, 2)}</td>
                    <td className="td text-right font-mono text-muted">{inr(t.fees, 2)}</td>
                    <td className="td text-right"><button aria-label="Delete transaction" onClick={async () => { await api.deleteTx(selected, t.id); done(); }} className="rounded-lg p-1.5 text-muted hover:bg-down/10 hover:text-down"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <AddTx open={add} onClose={() => setAdd(false)} pid={selected} onDone={done} />
      <ImportCsv open={imp} onClose={() => setImp(false)} pid={selected} onDone={done} />
    </div>
  );
}
