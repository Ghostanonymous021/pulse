import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";

const { Client } = pg;

async function loadEnv(fp) {
  const c = await fs.readFile(fp, "utf8");
  for (const l of c.split(/\r?\n/)) {
    const t = l.trim(); if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("="); if (i === -1) continue;
    const k = t.slice(0,i).trim(), v = t.slice(i+1).trim();
    if (k && !(k in process.env)) process.env[k] = v;
  }
}

async function query(client, label, sql, params=[]) {
  const rows = await client.query(sql, params);
  console.log(`\n${label} (${rows.rows.length})`);
  rows.rows.forEach(r => console.log(JSON.stringify(r)));
}

async function main() {
  await loadEnv(path.join(process.cwd(), ".env.local"));
  const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString: url, family: 4 });
  await client.connect();

  try {
    await query(client, "RLS POLICIES", `SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`);
    await query(client, "FUNCTIONS", `SELECT p.proname, pg_get_functiondef(p.oid) as definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' ORDER BY p.proname`);
    await query(client, "TRIGGERS", `SELECT tgname, tgrelid::regclass AS table_name, pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t WHERE tgisinternal = false ORDER BY tgrelid::regclass::text, tgname`);
    await query(client, "ENUMS", `SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typnamespace = 'public'::regnamespace ORDER BY t.typname, e.enumsortorder`);
    await query(client, "COUNTS", `SELECT relname AS table_name, n_live_tup AS row_count FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname`);
    await query(client, "AUTH USERS", "SELECT count(*) FROM auth.users");
    await query(client, "PROFILES", "SELECT count(*) FROM public.profiles");
  } finally {
    await client.end();
  }
}

main();
