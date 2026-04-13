import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./client";

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    create table if not exists schema_migrations (
      id serial primary key,
      filename text not null unique,
      applied_at timestamptz not null default now()
    )
  `);
}

async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const directory = path.resolve(process.cwd(), "src", "db", "migrations");
  const entries = (await readdir(directory)).filter((entry) => entry.endsWith(".sql")).sort();

  for (const filename of entries) {
    const alreadyApplied = await pool.query(
      "select 1 from schema_migrations where filename = $1",
      [filename]
    );

    if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
      continue;
    }

    const sql = await readFile(path.join(directory, filename), "utf8");

    await pool.query("begin");
    try {
      await pool.query(sql);
      await pool.query("insert into schema_migrations (filename) values ($1)", [filename]);
      await pool.query("commit");
      // eslint-disable-next-line no-console
      console.log(`Applied migration ${filename}`);
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  }
}

runMigrations()
  .then(() => pool.end())
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("Migration failed", error);
    await pool.end();
    process.exit(1);
  });