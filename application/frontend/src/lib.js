export const inr = (n, d = 0) => (n == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: d }).format(n));
export const compact = (n) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 2 }).format(n);
export const pct = (n, d = 2, sign = false) => (n == null ? "—" : `${sign && n > 0 ? "+" : ""}${(n * 100).toFixed(d)}%`);
export const num = (n, d = 2) => (n == null ? "—" : Number(n).toFixed(d));
export const tone = (n) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-muted");
export const short = (s) => s.replace(/\.NS$|\.BO$/, "");
export const COLORS = ["#2dd4bf", "#818cf8", "#fbbf24", "#fb7185", "#38bdf8", "#a78bfa", "#34d399", "#f472b6", "#94a3b8", "#fb923c"];
