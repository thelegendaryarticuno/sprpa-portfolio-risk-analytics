import { auth } from "./firebase";

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

async function call(path, { method = "GET", body, raw } = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !raw ? { "Content-Type": "application/json" } : {}), ...(raw ? { "Content-Type": "text/csv" } : {}) },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error?.code, j.error?.message || `Request failed (${res.status})`);
  return j;
}

export const api = {
  portfolios: () => call("/portfolios"),
  createPortfolio: (name) => call("/portfolios", { method: "POST", body: { name } }),
  createDemo: () => call("/portfolios/demo", { method: "POST" }),
  deletePortfolio: (id) => call(`/portfolios/${id}`, { method: "DELETE" }),
  transactions: (id) => call(`/portfolios/${id}/transactions`),
  addTx: (id, tx) => call(`/portfolios/${id}/transactions`, { method: "POST", body: tx }),
  deleteTx: (id, tid) => call(`/portfolios/${id}/transactions/${tid}`, { method: "DELETE" }),
  importCsv: (id, text) => call(`/portfolios/${id}/import`, { method: "POST", body: text, raw: true }),
  analytics: (id, q) => call(`/portfolios/${id}/analytics?${new URLSearchParams(q)}`),
  search: (q) => call(`/market/search?q=${encodeURIComponent(q)}`),
  quotes: (symbols) => call(`/market/quotes?symbols=${symbols.join(",")}`),
};
