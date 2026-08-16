import postgres from "postgres";

/**
 * Postgres driver for the store.
 *
 * The whole dataset lives in one JSONB row. That sounds crude, but it is
 * exactly right here: the event is a few hundred rows at most, every
 * mutation is a read-modify-write of related state, and `SELECT ... FOR
 * UPDATE` gives us the same all-or-nothing semantics the file store had —
 * except it now holds across serverless instances, which is what Vercel
 * needs.
 *
 * If the hunt ever outgrows this, split `doc` into real tables; nothing
 * above `transact`/`read` in lib/store.ts has to change.
 */

const TABLE = "hunt_state";
const ROW_ID = 1;

let sql: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

export function databaseUrl(): string | null {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.HUNT_DATABASE_URL ??
    null;
  return url && url.trim() ? url.trim() : null;
}

export function usingPostgres(): boolean {
  return databaseUrl() !== null;
}

function client(): postgres.Sql {
  if (sql) return sql;

  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set");

  // Local databases usually have no TLS; hosted ones always do.
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  const disabled = /sslmode=disable/.test(url);

  sql = postgres(url, {
    // Serverless: many short-lived instances, so keep each pool tiny and
    // let idle connections go rather than holding the provider's limit.
    max: Number(process.env.HUNT_DB_POOL ?? 3),
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: local || disabled ? false : "require",
    onnotice: () => {},
  });

  return sql;
}

/** Creates the table and seeds the row. Runs once per process. */
function ensure(empty: unknown): Promise<void> {
  if (ready) return ready;
  const db = client();
  ready = (async () => {
    await db`
      CREATE TABLE IF NOT EXISTS ${db(TABLE)} (
        id          integer PRIMARY KEY,
        doc         jsonb   NOT NULL,
        updated_at  timestamptz NOT NULL DEFAULT now()
      )
    `;
    await db`
      INSERT INTO ${db(TABLE)} (id, doc)
      VALUES (${ROW_ID}, ${db.json(empty as never)})
      ON CONFLICT (id) DO NOTHING
    `;
  })().catch((err) => {
    // Let the next call retry rather than wedging the process forever.
    ready = null;
    throw err;
  });
  return ready;
}

export async function pgLoad<T>(empty: T): Promise<T> {
  await ensure(empty);
  const db = client();
  const rows = await db<{ doc: T }[]>`
    SELECT doc FROM ${db(TABLE)} WHERE id = ${ROW_ID}
  `;
  return rows[0]?.doc ?? structuredClone(empty);
}

/**
 * Read-modify-write under a row lock, so two instances cannot interleave.
 * The callback may mutate the document in place, exactly as it did with
 * the file store.
 */
export async function pgTransact<T, D>(
  empty: D,
  fn: (doc: D) => T | Promise<T>,
): Promise<T> {
  await ensure(empty);
  const db = client();

  return db.begin(async (tx) => {
    const rows = await tx<{ doc: D }[]>`
      SELECT doc FROM ${tx(TABLE)} WHERE id = ${ROW_ID} FOR UPDATE
    `;
    const doc = rows[0]?.doc ?? structuredClone(empty);
    const result = await fn(doc);
    await tx`
      UPDATE ${tx(TABLE)}
         SET doc = ${tx.json(doc as never)}, updated_at = now()
       WHERE id = ${ROW_ID}
    `;
    return result;
  }) as Promise<T>;
}

/** Used by scripts so the process can exit. */
export async function pgClose(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = null;
    ready = null;
  }
}
