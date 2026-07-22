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
    const applied = await client.query("SELECT filename FROM schema_migrations ORDER BY filename");
    console.log("Applied migrations:", applied.rows.length);
    applied.rows.forEach(r => console.log(r.filename));
  } finally {
    await client.end();
  }
}

main();
