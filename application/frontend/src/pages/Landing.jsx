import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Activity, ShieldCheck, Sparkles, Layers, LineChart as LineIcon, Dices, Gauge, FileLock2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Aurora, BlurText, Button, Logo, Marquee, ShinyText, SpotlightCard, ThemeToggle } from "../ui";
import { useAuth } from "../state";

// Illustrative curve only (clearly labelled in the UI), not market data.
const demo = Array.from({ length: 60 }, (_, i) => ({ d: i, p: 100 + i * 0.55 + Math.sin(i / 4) * 4 + Math.sin(i / 9) * 3, b: 100 + i * 0.35 + Math.sin(i / 5) * 2.5 }));

const features = [
  { icon: Gauge, title: "Risk you can read", text: "Volatility, Sharpe, Sortino, beta, drawdown and Value at Risk, each with a plain-English meaning.", span: "md:col-span-2" },
  { icon: Dices, title: "Monte Carlo lab", text: "5,000 correlated simulations with a fixed seed, so every result is reproducible.", span: "" },
  { icon: LineIcon, title: "Beat-the-benchmark", text: "Cash-flow-aware performance against NIFTY 50.", span: "" },
  { icon: Layers, title: "Efficient frontier", text: "See the best mix of your own holdings for every risk level, and how far you sit from it.", span: "" },
  { icon: Sparkles, title: "Explainable insights", text: "Every sentence is built from engine numbers, with assumptions and uncertainty attached.", span: "" },
  { icon: FileLock2, title: "Read-only by design", text: "No trading, no custody, no broker passwords. Your data stays yours.", span: "" },
];
const chips = ["Value at Risk (95%)", "CVaR", "Sharpe ratio", "Sortino ratio", "Beta vs NIFTY 50", "Max drawdown", "Correlation matrix", "Stress tests", "Monte Carlo", "Efficient frontier", "Rolling volatility", "Allocation"];

export default function Landing() {
  const { user } = useAuth();
  const cta = user ? "/app" : "/auth";
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Aurora />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to={cta}><Button variant="ghost" size="sm">{user ? "Open app" : "Sign in"}</Button></Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-14 text-center md:pt-24">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-xs backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" /><ShinyText>India-focused · read-only · explainable</ShinyText>
        </motion.div>
        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          <BlurText text="Know the risk in your portfolio before the market shows you." />
        </h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mx-auto mt-6 max-w-2xl text-base text-muted sm:text-lg">
          SP‑RPA turns your NSE/BSE holdings into institutional-grade risk and performance analytics: VaR, drawdown, Monte Carlo, stress tests and optimisation, in plain language.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to={cta}><Button size="lg">Get started free <ArrowRight size={16} /></Button></Link>
          <a href="#features"><Button size="lg" variant="ghost">See what's inside</Button></a>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.8 }} className="relative mx-auto mt-16 max-w-4xl">
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-brand/40 via-brand2/20 to-transparent blur-sm" />
          <div className="card relative rounded-3xl p-5 text-left shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-down/70" /><i className="h-2.5 w-2.5 rounded-full bg-warn/70" /><i className="h-2.5 w-2.5 rounded-full bg-up/70" /></div>
              <span className="text-[11px] text-muted">Illustrative preview · not market data</span>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
              {[["Portfolio vs NIFTY", "+8.4%", "text-up"], ["Volatility", "14.2%", ""], ["VaR 95% · 1d", "₹ 18.4k", "text-down"]].map(([l, v, c]) => (
                <div key={l} className="rounded-xl border border-line bg-raised/50 p-3"><div className="text-[11px] text-muted">{l}</div><div className={`font-mono text-lg font-semibold ${c}`}>{v}</div></div>
              ))}
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={demo}>
                  <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity=".5" /><stop offset="1" stopColor="#2dd4bf" stopOpacity="0" /></linearGradient></defs>
                  <XAxis dataKey="d" hide /><YAxis hide domain={["dataMin-4", "dataMax+4"]} /><Tooltip content={() => null} />
                  <Area dataKey="b" stroke="#818cf8" strokeDasharray="4 4" fill="none" strokeWidth={1.5} isAnimationActive={false} />
                  <Area dataKey="p" stroke="#2dd4bf" fill="url(#lg)" strokeWidth={2.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="relative z-10 py-8"><Marquee>{chips.map((c) => <span key={c} className="whitespace-nowrap rounded-full border border-line bg-surface/70 px-4 py-2 text-sm text-muted">{c}</span>)}</Marquee></section>

      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Everything a risk desk would show you</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted">Built from the SP‑RPA specification: modular services, reproducible numbers, honest caveats.</p>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div key={f.title} className={f.span} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
              <SpotlightCard className="h-full p-6">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-brand/20 bg-brand/10 text-brand"><f.icon size={19} /></div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-24">
        <SpotlightCard className="p-10 text-center">
          <ShieldCheck className="mx-auto mb-4 text-brand" />
          <h2 className="text-2xl font-bold sm:text-3xl">Start with a demo portfolio in one click</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">Sign in with email or Google, load a labelled synthetic portfolio, and explore every analysis. Import your own CSV whenever you're ready.</p>
          <Link to={cta} className="mt-6 inline-block"><Button size="lg"><Activity size={16} /> Open SP‑RPA</Button></Link>
        </SpotlightCard>
      </section>

      <footer className="relative z-10 border-t border-line px-5 py-8 text-center text-xs text-muted">
        SP‑RPA is analytics software, not investment advice. Model outputs show assumptions and uncertainty, never trading certainty. · Group 29 · NIIT University
      </footer>
    </div>
  );
}
