import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://sprpa:sprpa@localhost:5432/sprpa",
});

// Numbered-migration style kept to one idempotent script: enough for this release.
export async function initDb(retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          uid TEXT PRIMARY KEY, email TEXT, name TEXT, photo TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS portfolios (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
          name TEXT NOT NULL, benchmark TEXT NOT NULL DEFAULT '^NSEI',
          is_demo BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
          symbol TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('BUY','SELL')),
          quantity NUMERIC(18,6) NOT NULL CHECK (quantity > 0),
          price NUMERIC(18,6) NOT NULL CHECK (price >= 0),
          fees NUMERIC(18,6) NOT NULL DEFAULT 0,
          trade_date DATE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS tx_portfolio_idx ON transactions(portfolio_id);
        CREATE TABLE IF NOT EXISTS audit_log (
          id BIGSERIAL PRIMARY KEY, uid TEXT, action TEXT, resource TEXT,
          ip TEXT, created_at TIMESTAMPTZ DEFAULT now()
        );
      `);
      return;
    } catch (e) {
      console.log(`db not ready (${e.code || e.message}), retry ${i + 1}/${retries}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("database unavailable");
}
