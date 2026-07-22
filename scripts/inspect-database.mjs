import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";

const { Client } = pg;

async function loadEnv(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function formatRows(title, rows, cols) {
  console.log(`\n=== ${title} ===`);
  if (!rows || rows.length === 0) {
    console.log("  (empty)");
    return;
  }
  const widths = {};
  for (const col of cols) {
    widths[col] = col.length;
  }
  for (const row of rows) {
    for (const col of cols) {
      const val = String(row[col] ?? "");
      widths[col] = Math.max(widths[col], val.length);
    }
  }
  const sep = cols.map(c => "-".repeat(widths[c])).join(" | ");
  console.log("  " + cols.map(c => String(c).padEnd(widths[c])).join(" | "));
  console.log("  " + sep);
  for (const row of rows) {
    console.log("  " + cols.map(c => String(row[c] ?? "").padEnd(widths[c])).join(" | "));
  }
}

async function main() {
  await loadEnv(path.join(process.cwd(), ".env.local"));
  const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString: url, family: 4 });
  await client.connect();

  try {
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    formatRows("TABLES", tables.rows, ["table_name"]);

    for (const table of tables.rows) {
      const cols = await client.query(
        `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table.table_name]
      );
      formatRows(`COLUMNS: ${table.table_name}`, cols.rows, ["column_name", "data_type", "character_maximum_length", "is_nullable", "column_default"]);
    }

    const indexes = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname");
    formatRows("INDEXES", indexes.rows, ["indexname", "indexdef"]);

    const policies = await client.query(
      `SELECT tablename, policyname, permissive, roles, cmd
       FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`
    );
    formatRows("RLS POLICIES", policies.rows, ["tablename", "policyname", "cmd", "roles"]);

    const funcs = await client.query(
      `SELECT p.proname, pg_get_functiondef(p.oid) as definition
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
       ORDER BY p.proname`
    );
    formatRows("FUNCTIONS", funcs.rows, ["proname", "definition"]);

    const triggers = await client.query(
      `SELECT tgname, tgrelid::regclass AS table_name, pg_get_triggerdef(t.oid) AS definition
       FROM pg_trigger t
       WHERE tgisinternal = false
       ORDER BY tgrelid::regclass::text, tgname`
    );
    formatRows("TRIGGERS", triggers.rows, ["table_name", "tgname"]);

    const fks = await client.query(
      `SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE contype = 'f' AND connamespace = 'public'::regnamespace
       ORDER BY conrelid::regclass::text, conname`
    );
    formatRows("FOREIGN KEYS", fks.rows, ["table_name", "conname", "definition"]);

    const counts = await client.query(
      `SELECT relname AS table_name, n_live_tup AS row_count
       FROM pg_stat_user_tables
       WHERE schemaname = 'public'
       ORDER BY relname`
    );
    formatRows("ROW COUNTS", counts.rows, ["table_name", "row_count"]);

    const enums = await client.query(
      `SELECT t.typname, e.enumlabel
       FROM pg_type t
       JOIN pg_enum e ON t.oid = e.enumtypid
       WHERE t.typnamespace = 'public'::regnamespace
       ORDER BY t.typname, e.enumsortorder`
    );
    const enumMap = {};
    for (const row of enums.rows) {
      if (!enumMap[row.typname]) enumMap[row.typname] = [];
      enumMap[row.typname].push(row.enumlabel);
    }
    console.log("\n=== ENUMS ===");
    for (const [name, values] of Object.entries(enumMap)) {
      console.log(`  ${name}: ${values.join(", ")}`);
    }

    const authCount = await client.query("SELECT count(*) FROM auth.users");
    console.log(`\n=== AUTH USERS: ${authCount.rows[0].count} ===`);

    const profileCount = await client.query("SELECT count(*) FROM public.profiles");
    console.log(`=== PROFILES: ${profileCount.rows[0].count} ===`);

  } finally {
    await client.end();
  }
}

main();
