import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ComposedChart } from "recharts";
import { Sparkles } from "lucide-react";
import { api } from "../api";
import { useAsync, usePortfolios } from "../state";
import { Button, ChartCard, ChartTip, CountUp, InfoTip, SpotlightCard, Stat } from "../ui";
import { Gate, SourceBadge } from "./Dashboard";
import { inr, num, pct, short } from "../lib";

const heat = (v) => {
  const a = Math.min(1, Math.abs(v));
  return v >= 0 ? `rgb(45 212 191 / ${0.1 + a * 0.75})` : `rgb(251 113 133 / ${0.1 + a * 0.75})`;
};

function Heatmap({ corr }) {
  const n = corr.symbols.length;
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-1 text-[11px]" style={{ gridTemplateColumns: `64px repeat(${n}, minmax(44px, 1fr))` }}>
        <div />
        {corr.symbols.map((s) => <div key={s} className="truncate text-center text-muted">{short(s)}</div>)}
        {corr.matrix.map((row, i) => (
          <div key={i} className="contents">
            <div className="truncate pr-2 text-right text-muted">{short(corr.symbols[i])}</div>
            {row.map((v, j) => <div key={j} title={`${short(corr.symbols[i])} × ${short(corr.symbols[j])}: ${v}`} className="grid h-10 place-items-center rounded-md font-mono text-fg" style={{ background: heat(v) }}>{v.toFixed(2)}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Insight text: every number is produced by the engine; this only fills sentences (SDD 4.5).
function Insight({ d }) {
  const m = d.metrics, top = [...d.assets].sort((a, b) => b.weight - a.weight)[0];
  const hi = d.corr.matrix.flatMap((r, i) => r.map((v, j) => ({ v, i, j }))).filter((x) => x.i < x.j).sort((a, b) => b.v - a.v)[0];
  const s = [
    `Over the last ${d.days} trading days the portfolio returned ${pct(m.totalReturn, 1, true)} versus ${pct(m.benchTotal, 1, true)} for the NIFTY 50, with annualised volatility of ${pct(m.vol, 1)} and a beta of ${num(m.beta)}.`,
    `On a typical bad day (${Math.round(m.conf * 100)}% confidence) the historical one-day loss is about ${inr(m.var.historical)}; the average loss on the worst days (CVaR) is ${inr(m.var.cvar)}.`,
    `${short(top.symbol)} is your largest position at ${pct(top.weight, 1)} of value.${hi && hi.v > 0.6 ? ` ${short(d.corr.symbols[hi.i])} and ${short(d.corr.symbols[hi.j])} move closely together (correlation ${hi.v.toFixed(2)}), so they add less diversification than they appear to.` : ""}`,
    `The frontier suggests a higher risk-adjusted return was available from your same stocks (Sharpe ${num(d.frontier.maxSharpe.sharpe)} vs ${num(m.sharpe)} today). This uses past data and is an exploration, not advice.`,
  ];
  return (
    <SpotlightCard className="p-5" color="rgb(var(--brand2) / .16)">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-brand2" /> Insights <span className="rounded-full border border-line bg-raised px-2 py-0.5 text-[10px] font-medium text-muted">template-generated from engine numbers</span></div>
      <ul className="space-y-2 text-sm leading-relaxed text-muted">{s.map((t, i) => <li key={i} className="flex gap-2.5"><i className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />{t}</li>)}</ul>
    </SpotlightCard>
  );
}

export default function Risk() {
  const { selected, current } = usePortfolios();
  const [p, setP] = useState({ range: "1y", conf: 0.95, horizon: 10, sims: 5000 });
  const [run, setRun] = useState(p);
  const state = useAsync(() => api.analytics(selected, run), [selected, run]);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">Risk Lab</h1><p className="mt-1 text-sm text-muted">{current?.name} · VaR, scenarios and optimisation · all runs are reproducible (fixed seed)</p></div>
        {state.data?.dataSource && <SourceBadge s={state.data.dataSource} />}
      </div>

      <SpotlightCard className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); setRun({ ...p }); }} className="grid grid-cols-2 items-end gap-3 md:grid-cols-5">
          <div><label className="label">Lookback</label><select className="input" value={p.range} onChange={set("range")}><option value="6m">6 months</option><option value="1y">1 year</option><option value="2y">2 years</option></select></div>
          <div><label className="label">Confidence</label><select className="input" value={p.conf} onChange={set("conf")}><option value={0.9}>90%</option><option value={0.95}>95%</option><option value={0.99}>99%</option></select></div>
          <div><label className="label">Horizon (days)</label><input className="input" type="number" min={1} max={30} value={p.horizon} onChange={set("horizon")} /></div>
          <div><label className="label">Simulations</label><select className="input" value={p.sims} onChange={set("sims")}><option value={1000}>1,000</option><option value={5000}>5,000</option><option value={20000}>20,000</option></select></div>
          <Button size="lg" className="col-span-2 md:col-span-1" disabled={state.loading}>{state.loading ? "Running…" : "Run analysis"}</Button>
        </form>
      </SpotlightCard>

      <Gate state={state}>{(d) => <Body d={d} />}</Gate>
    </div>
  );
}

function Body({ d }) {
  const m = d.metrics, mc = d.monteCarlo, fr = d.frontier;
  const dd = d.drawdown;
  const tk = (arr, k = "date") => arr.filter((_, i) => i % Math.ceil(arr.length / 6) === 0).map((x) => x[k]);
  const fan = mc.fan.map((f) => ({ ...f, r90: [f.p5, f.p95], r50: [f.p25, f.p75] }));
  const cl = Math.round(m.conf * 100);
  const cur = [{ vol: fr.current.vol, ret: fr.current.ret }], bs = [{ vol: fr.maxSharpe.vol, ret: fr.maxSharpe.ret }], mv = [{ vol: fr.minVol.vol, ret: fr.minVol.ret }];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat delay={0} label={`Historical VaR ${cl}% · ${m.horizon}d`} value={<span className="text-down"><CountUp value={m.var.historical * Math.sqrt(1)} format={inr} /></span>} sub="from past daily returns" tip="Loss not expected to be exceeded on more than (100 − confidence)% of days, using the actual past return distribution." />
        <Stat delay={0.05} label={`Parametric VaR ${cl}%`} value={<span className="text-down"><CountUp value={m.var.parametric} format={inr} /></span>} sub="assumes bell-curve returns" tip="(z × σ − μ) × value × √days. Faster but understates fat-tail risk." />
        <Stat delay={0.1} label={`Monte Carlo VaR ${cl}%`} value={<span className="text-down"><CountUp value={mc.var} format={inr} /></span>} sub={`${mc.sims.toLocaleString()} sims · ${mc.horizon}d · P(loss) ${mc.probLossPct.toFixed(0)}%`} tip="Simulates thousands of correlated futures (Cholesky of the covariance matrix) and reads the loss at the chosen percentile." />
        <Stat delay={0.15} label={`CVaR ${cl}% (expected shortfall)`} value={<span className="text-down"><CountUp value={m.var.cvar} format={inr} /></span>} sub={`Sortino ${num(m.sortino)} · α ${pct(m.alpha, 1, true)}`} tip="The average loss on the days that are worse than the VaR threshold." />
      </div>

      <Insight d={d} />

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Drawdown" tip="Fall from the highest value reached so far. Max drawdown is the deepest such fall." right={<span className="font-mono text-xs text-down">max {pct(m.maxDrawdown)}</span>}>
          <div className="h-64"><ResponsiveContainer>
            <AreaChart data={dd} margin={{ left: -10 }}>
              <defs><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fb7185" stopOpacity="0" /><stop offset="1" stopColor="#fb7185" stopOpacity=".45" /></linearGradient></defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" ticks={tk(dd)} tickLine={false} axisLine={false} tickFormatter={(s) => s.slice(2, 7)} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={48} />
              <Tooltip content={<ChartTip fmt={(v) => `${v}%`} />} />
              <Area name="Drawdown" dataKey="dd" stroke="#fb7185" strokeWidth={2} fill="url(#gd)" dot={false} />
            </AreaChart></ResponsiveContainer></div>
        </ChartCard>

        <ChartCard title="Rolling 30-day volatility" tip="Annualised volatility over a moving 30-day window. Spikes mark stressed periods.">
          <div className="h-64"><ResponsiveContainer>
            <AreaChart data={d.rolling} margin={{ left: -10 }}>
              <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#818cf8" stopOpacity=".4" /><stop offset="1" stopColor="#818cf8" stopOpacity="0" /></linearGradient></defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" ticks={tk(d.rolling)} tickLine={false} axisLine={false} tickFormatter={(s) => s.slice(2, 7)} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={48} />
              <Tooltip content={<ChartTip fmt={(v) => `${v}%`} />} />
              <Area name="Volatility" dataKey="vol" stroke="#818cf8" strokeWidth={2} fill="url(#gv)" dot={false} />
            </AreaChart></ResponsiveContainer></div>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title={`Monte Carlo fan · next ${mc.horizon} days`} tip="Shaded bands show the 5–95% and 25–75% range of simulated cumulative return. The line is the median. This is a range of outcomes, not a forecast." right={<span className="font-mono text-xs text-muted">seed {mc.seed}</span>}>
          <div className="h-72"><ResponsiveContainer>
            <ComposedChart data={fan} margin={{ left: -10 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={(v) => `d${v}`} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={48} />
              <Tooltip content={<ChartTip fmt={(v) => (Array.isArray(v) ? `${v[0]}% … ${v[1]}%` : `${v}%`)} />} />
              <ReferenceLine y={0} stroke="rgb(var(--muted))" strokeDasharray="4 4" />
              <Area name="5–95%" dataKey="r90" stroke="none" fill="#818cf8" fillOpacity={0.18} />
              <Area name="25–75%" dataKey="r50" stroke="none" fill="#2dd4bf" fillOpacity={0.3} />
              <Line name="Median" dataKey="p50" stroke="#2dd4bf" strokeWidth={2.4} dot={false} />
            </ComposedChart></ResponsiveContainer></div>
        </ChartCard>

        <ChartCard title="Distribution of simulated outcomes" tip="How many simulations ended at each return. Red bars are losses." right={<span className="font-mono text-xs text-muted">E[r] {mc.expectedReturnPct.toFixed(2)}%</span>}>
          <div className="h-72"><ResponsiveContainer>
            <BarChart data={mc.hist} margin={{ left: -10 }} barCategoryGap={1}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="x" tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v)}%`} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTip fmt={(v) => `${v} sims`} />} />
              <Bar name="Simulations" dataKey="n" radius={[3, 3, 0, 0]}>{mc.hist.map((h, i) => <Cell key={i} fill={h.x < 0 ? "#fb7185" : "#2dd4bf"} fillOpacity={0.85} />)}</Bar>
            </BarChart></ResponsiveContainer></div>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <ChartCard className="xl:col-span-3" title="Efficient frontier" tip="Each dot is a random mix of YOUR holdings (long-only, weights sum to 100%). Up and left is better. Based on past returns, so treat it as exploration.">
          <div className="h-80"><ResponsiveContainer>
            <ScatterChart margin={{ left: -4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="vol" name="Volatility" unit="%" tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => v.toFixed(0)} />
              <YAxis type="number" dataKey="ret" name="Return" unit="%" tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => v.toFixed(0)} width={44} />
              <ZAxis range={[26, 26]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTip fmt={(v) => `${Number(v).toFixed(1)}%`} />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Scatter name="Random mixes" data={fr.points} fill="#818cf8" fillOpacity={0.35} />
              <Scatter name="Your portfolio" data={cur} fill="#fbbf24" shape="star" legendType="star"><ZAxis range={[220, 220]} /></Scatter>
              <Scatter name="Max Sharpe" data={bs} fill="#2dd4bf"><ZAxis range={[160, 160]} /></Scatter>
              <Scatter name="Min volatility" data={mv} fill="#fb7185"><ZAxis range={[160, 160]} /></Scatter>
            </ScatterChart></ResponsiveContainer></div>
        </ChartCard>

        <ChartCard className="xl:col-span-2" title="Suggested weights (exploration)" tip="Weights of the best mixes found among 2,000 random portfolios. Not a recommendation.">
          <table className="w-full">
            <thead><tr><th className="th">Stock</th><th className="th text-right">Now</th><th className="th text-right">Max Sharpe</th><th className="th text-right">Min vol</th></tr></thead>
            <tbody>
              {d.assets.map((a, i) => (
                <tr key={a.symbol} className="border-t border-line/60">
                  <td className="td font-medium">{short(a.symbol)}</td>
                  <td className="td text-right font-mono text-muted">{pct(a.weight, 1)}</td>
                  <td className="td text-right font-mono text-brand">{pct(fr.maxSharpe.weights[i].weight, 1)}</td>
                  <td className="td text-right font-mono text-down">{pct(fr.minVol.weights[i].weight, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">Max Sharpe: {num(fr.maxSharpe.sharpe)} · {fr.maxSharpe.ret.toFixed(1)}% return at {fr.maxSharpe.vol.toFixed(1)}% vol. Look-ahead bias applies: weights are fitted to the same history they are judged on.</p>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Correlation matrix" tip="How similarly two stocks' daily returns move. Close to +1 = move together (little diversification). Negative = offset each other.">
          <Heatmap corr={d.corr} />
        </ChartCard>
        <ChartCard title="Stress test: market shock" tip="Estimated portfolio impact if the NIFTY 50 fell by the given amount: Σ weight × shock × beta.">
          <div className="h-64"><ResponsiveContainer>
            <BarChart data={d.stress.map((s) => ({ name: `${s.shock * 100}%`, loss: Math.round(s.loss), pct: s.impactPct }))} margin={{ left: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={48} />
              <Tooltip cursor={{ fill: "rgb(var(--raised) / .5)" }} content={<ChartTip fmt={(v, n) => (n === "Impact" ? inr(v) : v)} />} />
              <Bar name="Impact" dataKey="loss" radius={[6, 6, 0, 0]} fill="#fb7185" />
            </BarChart></ResponsiveContainer></div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">{d.stress.map((s) => <div key={s.shock} className="rounded-lg bg-raised/60 py-1.5"><div className="text-muted">{s.shock * 100}% mkt</div><div className="font-mono font-medium text-down">{s.impactPct.toFixed(1)}%</div></div>)}</div>
        </ChartCard>
      </div>
    </>
  );
}
