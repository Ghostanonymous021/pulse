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

async function main() {
  await loadEnv(path.join(process.cwd(), ".env.local"));
  const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString: url, family: 4 });
  await client.connect();

  try {
    const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schema_migrations' ORDER BY ordinal_position");
    console.log("schema_migrations columns:");
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    
    const sample = await client.query("SELECT * FROM schema_migrations LIMIT 2");
    console.log("\nSample rows:", sample.rows);
  } finally {
    await client.end();
  }
}

main();
