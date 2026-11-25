// UI primitives modelled on React Bits (Aurora, SpotlightCard, CountUp, ShinyText, BlurText, Marquee)
// and 21st.dev patterns (shimmer gradient button, bento stat cards, animated sidebar pill).
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView } from "framer-motion";
import { Info, Moon, Sun, X, TrendingUp } from "lucide-react";

export function Logo({ size = 32 }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid place-items-center rounded-xl bg-gradient-to-br from-brand to-brand2 text-bg shadow-lg shadow-brand/30" style={{ width: size, height: size }}>
        <TrendingUp size={size * 0.58} strokeWidth={2.6} />
      </div>
      <span className="text-[15px] font-semibold tracking-tight">SP‑RPA</span>
    </div>
  );
}

export function Aurora({ className = "" }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="absolute -left-24 -top-24 h-[480px] w-[480px] animate-float rounded-full bg-brand/25 blur-[110px]" />
      <div className="absolute -right-24 top-10 h-[420px] w-[420px] animate-float rounded-full bg-brand2/25 blur-[110px]" style={{ animationDelay: "-5s" }} />
      <div className="absolute bottom-[-160px] left-1/3 h-[380px] w-[380px] animate-float rounded-full bg-fuchsia-500/15 blur-[120px]" style={{ animationDelay: "-9s" }} />
      <div className="dot-grid absolute inset-0" />
    </div>
  );
}

export function SpotlightCard({ children, className = "", color = "rgb(var(--brand) / .16)" }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: -999, y: -999 });
  return (
    <div
      ref={ref}
      onMouseMove={(e) => { const r = ref.current.getBoundingClientRect(); setPos({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
      onMouseLeave={() => setPos({ x: -999, y: -999 })}
      className={`card relative overflow-hidden ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ background: `radial-gradient(360px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 70%)` }} />
      <div className="relative">{children}</div>
    </div>
  );
}

export function CountUp({ value, format = (n) => n.toFixed(0), duration = 1.1 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const prev = useRef(0);
  useEffect(() => {
    if (!inView || value == null || isNaN(value)) return;
    const c = animate(prev.current, value, { duration, ease: "easeOut", onUpdate: (v) => { if (ref.current) ref.current.textContent = format(v); } });
    prev.current = value;
    return () => c.stop();
  }, [value, inView]); // eslint-disable-line
  return <span ref={ref}>{format(0)}</span>;
}

export function ShinyText({ children, className = "" }) {
  return (
    <span className={`animate-shine bg-clip-text text-transparent ${className}`}
      style={{ backgroundImage: "linear-gradient(110deg, rgb(var(--fg) / .55) 35%, rgb(var(--fg)) 50%, rgb(var(--fg) / .55) 65%)", backgroundSize: "200% 100%" }}>
      {children}
    </span>
  );
}

export function BlurText({ text, className = "", delay = 0.06 }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <motion.span key={i} className="inline-block" initial={{ opacity: 0, filter: "blur(10px)", y: 14 }} animate={{ opacity: 1, filter: "blur(0px)", y: 0 }} transition={{ delay: i * delay, duration: 0.6, ease: "easeOut" }}>
          {w}&nbsp;
        </motion.span>
      ))}
    </span>
  );
}

export function Marquee({ children }) {
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <div className="flex w-max animate-marquee gap-3">{children}{children}</div>
    </div>
  );
}

const sizes = { md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-[15px]", sm: "px-3 py-1.5 text-xs" };
export function Button({ variant = "primary", size = "md", className = "", children, ...p }) {
  const v = {
    primary: "bg-gradient-to-b from-brand to-brand/80 text-bg font-semibold shadow-lg shadow-brand/25 hover:shadow-brand/40 hover:brightness-110",
    ghost: "border border-line bg-raised/50 text-fg hover:bg-raised",
    danger: "border border-down/30 bg-down/10 text-down hover:bg-down/20",
  }[variant];
  return (
    <button {...p} className={`relative inline-flex items-center justify-center gap-2 rounded-xl transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 ${sizes[size]} ${v} ${className}`}>
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onMouseDown={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-label={title} className="card w-full max-w-lg p-6 shadow-2xl" initial={{ y: 20, scale: 0.97 }} animate={{ y: 0, scale: 1 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-fg"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-xl bg-raised ${className}`} />;

export function InfoTip({ text }) {
  return (
    <span className="group relative inline-flex align-middle">
      <Info size={13} className="text-muted/70 transition group-hover:text-brand" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-line bg-raised p-2.5 text-xs font-normal normal-case leading-snug tracking-normal text-fg opacity-0 shadow-xl transition group-hover:opacity-100">{text}</span>
    </span>
  );
}

export function Badge({ children, tone = "brand" }) {
  const t = { brand: "bg-brand/10 text-brand border-brand/20", warn: "bg-warn/10 text-warn border-warn/25", muted: "bg-raised text-muted border-line" }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const flip = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("theme", d ? "dark" : "light"); } catch {}
  };
  return (
    <button onClick={flip} aria-label="Toggle theme" className="rounded-xl border border-line bg-raised/50 p-2 text-muted transition hover:text-fg">
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function Stat({ label, value, sub, tip, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.45 }}>
      <SpotlightCard className="p-5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted">{label}{tip && <InfoTip text={tip} />}</div>
        <div className="mt-2 font-mono text-[26px] font-semibold tracking-tight">{value}</div>
        {sub && <div className="mt-1 text-xs">{sub}</div>}
      </SpotlightCard>
    </motion.div>
  );
}

export function ChartCard({ title, tip, right, children, className = "" }) {
  return (
    <SpotlightCard className={`p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">{title}{tip && <InfoTip text={tip} />}</h3>
        {right}
      </div>
      {children}
    </SpotlightCard>
  );
}

export const ChartTip = ({ active, payload, label, fmt = (v) => v }) =>
  active && payload?.length ? (
    <div className="rounded-xl border border-line bg-raised/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label != null && <div className="mb-1 font-medium text-muted">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto font-mono font-medium text-fg">{fmt(p.value, p.name)}</span>
        </div>
      ))}
    </div>
  ) : null;
