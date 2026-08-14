/**
 * One tiny query interface over two drivers.
 *
 *   production  Neon Postgres over HTTP. No connection pool to tune, which is
 *               the whole reason for choosing it in a serverless runtime.
 *   local       PGlite, real Postgres compiled to WASM. Same SQL dialect, so
 *               the schema and every query are verifiable before a cloud
 *               database exists.
 *
 * Selection is by DATABASE_URL alone. PGlite is a devDependency and is loaded
 * through a specifier the bundler cannot resolve statically, so it never ends
 * up inside a deployed function.
 */

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs a multi-statement script. The Neon HTTP endpoint takes one
   *  statement per request, so scripts are split and sent in sequence. */
  exec(script: string): Promise<void>;
  driver: "neon" | "pglite";
}

let cached: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;

  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    cached = {
      driver: "neon",
      async query<T>(text: string, params: unknown[] = []) {
        return (await sql(text, params as any[])) as T[];
      },
      async exec(script: string) {
        for (const stmt of splitStatements(script)) {
          await sql(stmt, []);
        }
      },
    };
    return cached;
  }

  // Local path. The specifier is assembled at runtime so no bundler follows it.
  const pkg = ["@electric-sql", "pglite"].join("/");
  const { PGlite } = (await import(/* @vite-ignore */ pkg)) as {
    PGlite: new (dir?: string) => {
      query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
      exec(script: string): Promise<unknown>;
    };
  };
  const pg = new PGlite(process.env.PGLITE_DIR ?? ".pglite");
  cached = {
    driver: "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query<T>(text, params);
      return res.rows;
    },
    async exec(script: string) {
      await pg.exec(script);
    },
  };
  return cached;
}

function splitStatements(script: string): string[] {
  return script
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^--/.test(s));
}

/** Postgres returns DATE columns as JS Date objects under some drivers and as
 *  strings under others. Everything downstream wants YYYY-MM-DD. */
export function asDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
