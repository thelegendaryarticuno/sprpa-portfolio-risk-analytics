import { useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useAsync, usePortfolios } from "../state";
import { Badge, Button, ChartCard, ChartTip, CountUp, Skeleton, Stat } from "../ui";
import { COLORS, compact, inr, num, pct, short, tone } from "../lib";

export const RANGES = [["6m", "6M"], ["1y", "1Y"], ["2y", "2Y"]];

export function RangePills({ value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-raised/50 p-1">
      {RANGES.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-lg px-3 py-1 text-xs font-medium transition ${value === v ? "bg-brand/15 text-brand" : "text-muted hover:text-fg"}`}>{l}</button>
      ))}
    </div>
  );
}

// Shared loading / error / empty wrapper for analytics-backed pages.
export function Gate({ state, children }) {
  const { data, error, loading, reload } = state;
  if (loading && !data) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={i < 4 ? "h-28" : "h-72 sm:col-span-2"} />)}</div>;
  if (error) return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <AlertTriangle className="mx-auto mb-3 text-warn" /><p className="font-medium">Couldn't compute analytics</p><p className="mt-1 text-sm text-muted">{error.message}</p>
      <Button className="mt-5" variant="ghost" onClick={reload}><RefreshCw size={14} /> Retry</Button>
    </div>
  );
  if (data?.empty) return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <p className="font-medium">This portfolio has no holdings yet</p><p className="mt-1 text-sm text-muted">Add a transaction or import a CSV to see analytics.</p>
      <Link to="/app/portfolio"><Button className="mt-5"><Plus size={15} /> Add holdings</Button></Link>
    </div>
  );
  return <div className={loading ? "opacity-60 transition" : "transition"}>{children(data)}</div>;
}

export const SourceBadge = ({ s }) => s === "yahoo" ? <Badge>Live provider data · daily close</Badge> : <Badge tone="warn">Synthetic demo data</Badge>;

export default function Dashboard() {
  const { selected, current } = usePortfolios();
  const [range, setRange] = useState("1y");
  const state = useAsync(() => api.analytics(selected, { range, horizon: 1, sims: 500 }), [selected, range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{current?.name || "Dashboard"}</h1>
          <p className="mt-1 text-sm text-muted">Performance and risk at a glance{state.data?.asOf ? ` · as of ${state.data.asOf}` : ""}</p>
        </div>
        <div className="flex items-center gap-3">{state.data?.dataSource && <SourceBadge s={state.data.dataSource} />}<RangePills value={range} onChange={setRange} /></div>
      </div>

      <Gate state={state}>{(d) => <Body d={d} />}</Gate>
    </div>
  );
}

function Body({ d }) {
  const m = d.metrics;
  const alloc = d.assets.map((a) => ({ name: short(a.symbol), value: a.value }));
  const excess = m.totalReturn - m.benchTotal;
  const contrib = [...d.assets].sort((a, b) => b.contribution - a.contribution).map((a) => ({ name: short(a.symbol), v: +(a.contribution * 100).toFixed(2) }));
  const ticks = d.performance.filter((_, i) => i % Math.ceil(d.performance.length / 6) === 0).map((p) => p.date);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat delay={0} label="Portfolio value" value={<CountUp value={d.value} format={(n) => inr(n)} />} sub={<span className={tone(d.pnl)}>{d.pnl >= 0 ? "▲" : "▼"} {inr(Math.abs(d.pnl))} vs cost {inr(d.invested)}</span>} tip="Current market value of all holdings versus what you paid, including fees." />
        <Stat delay={0.05} label={`Return (${d.days}d)`} value={<span className={tone(m.totalReturn)}><CountUp value={m.totalReturn * 100} format={(n) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`} /></span>} sub={<span className={tone(excess)}>{pct(excess, 2, true)} vs NIFTY 50 ({pct(m.benchTotal, 2, true)})</span>} tip="Price-only return over the selected window, compared with the NIFTY 50 over the same days. Assumes today's holdings were held throughout." />
        <Stat delay={0.1} label="Volatility (annual)" value={<CountUp value={m.vol * 100} format={(n) => `${n.toFixed(1)}%`} />} sub={<span className="text-muted">Beta {num(m.beta)} · Sharpe {num(m.sharpe)}</span>} tip="Standard deviation of daily returns × √252. Higher means a bumpier ride." />
        <Stat delay={0.15} label={`VaR ${Math.round(m.conf * 100)}% · 1 day`} value={<span className="text-down"><CountUp value={m.var.historical} format={(n) => inr(n)} /></span>} sub={<span className="text-muted">Max drawdown {pct(m.maxDrawdown)}</span>} tip="Historical Value at Risk: a one-day loss this large was exceeded on only 5 of 100 past days." />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="Performance vs NIFTY 50" tip="Both lines are rebased to 100 at the start of the window." right={<span className="font-mono text-xs text-muted">rebased · 100</span>}>
          <div className="h-80">
            <ResponsiveContainer>
              <AreaChart data={d.performance} margin={{ left: -10, right: 8 }}>
                <defs><linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity=".4" /><stop offset="1" stopColor="#2dd4bf" stopOpacity="0" /></linearGradient></defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" ticks={ticks} tickLine={false} axisLine={false} tickFormatter={(s) => s.slice(2, 7)} />
                <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTip fmt={(v) => v.toFixed(2)} />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area name="NIFTY 50" dataKey="benchmark" stroke="#818cf8" strokeWidth={1.6} strokeDasharray="5 4" fill="none" dot={false} />
                <Area name="Portfolio" dataKey="portfolio" stroke="#2dd4bf" strokeWidth={2.4} fill="url(#gp)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Allocation" tip="Share of current market value by holding.">
          <div className="relative h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={alloc} dataKey="value" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none">{alloc.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                <Tooltip content={<ChartTip fmt={(v) => inr(v)} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="text-[11px] text-muted">Holdings</div><div className="font-mono text-xl font-semibold">{d.assets.length}</div><div className="text-[11px] text-muted">{compact(d.value)}</div></div></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {alloc.map((a, i) => <div key={a.name} className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="truncate">{a.name}</span><span className="ml-auto font-mono text-muted">{pct(d.assets[i].weight, 1)}</span></div>)}
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="Holdings">
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr><th className="th">Symbol</th><th className="th text-right">Price</th><th className="th text-right">Value</th><th className="th">Weight</th><th className="th text-right">Return</th><th className="th text-right">Vol</th><th className="th text-right">Beta</th></tr></thead>
              <tbody>
                {[...d.assets].sort((a, b) => b.weight - a.weight).map((a) => (
                  <tr key={a.symbol} className="border-t border-line/60 transition hover:bg-raised/40">
                    <td className="td font-medium">{short(a.symbol)}</td>
                    <td className="td text-right font-mono">{inr(a.price, 2)}</td>
                    <td className="td text-right font-mono">{inr(a.value)}</td>
                    <td className="td"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-brand" style={{ width: `${a.weight * 100}%` }} /></div><span className="font-mono text-xs text-muted">{pct(a.weight, 1)}</span></div></td>
                    <td className={`td text-right font-mono ${tone(a.return)}`}>{pct(a.return, 1, true)}</td>
                    <td className="td text-right font-mono text-muted">{pct(a.vol, 1)}</td>
                    <td className="td text-right font-mono text-muted">{num(a.beta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
        <ChartCard title="Contribution to return" tip="Weight × the stock's own return: how many percentage points each holding added to the portfolio.">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={contrib} layout="vertical" margin={{ left: 0, right: 12 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={74} />
                <Tooltip cursor={{ fill: "rgb(var(--raised) / .5)" }} content={<ChartTip fmt={(v) => `${v}%`} />} />
                <Bar name="Contribution" dataKey="v" radius={4}>{contrib.map((c, i) => <Cell key={i} fill={c.v >= 0 ? "#34d399" : "#fb7185"} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </>
  );
}
