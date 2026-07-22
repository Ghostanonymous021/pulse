import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";

const { Client } = pg;

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const MISSING = [
  "20260718170000_chat_whatsapp.sql",
  "20260718180000_settings_prefs.sql",
  "20260718190000_professional_requests.sql",
  "20260718191000_professional_tipo_detalhe.sql",
  "20260718200000_username_dots.sql",
  "20260718210000_chat_audio.sql",
  "20260718220000_verification.sql",
  "20260718250000_security_harden.sql",
  "20260719120000_chat_unread.sql",
  "20260719130000_drop_message_notifications.sql",
  "20260719140000_push_subscriptions.sql",
  "20260719150000_enforce_dm_permission.sql",
  "20260719160000_enforce_blocks.sql",
  "20260720100000_chat_inbox_actions.sql",
  "20260720110000_chat_delivery_and_search.sql",
  "20260720120000_chat_link_previews.sql",
  "20260721223000_workspaces.sql",
];

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

function normalizeSql(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  await loadEnv(path.join(process.cwd(), ".env.local"));
  const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;

  const client = new Client({ connectionString: url, family: 4 });
  await client.connect();

  try {
    const applied = await client.query("SELECT filename FROM schema_migrations");
    const appliedSet = new Set(applied.rows.map(r => r.filename));
    console.log(`Migrations já aplicadas: ${appliedSet.size}`);

    let appliedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const file of MISSING) {
      if (appliedSet.has(file)) {
        console.log(`SKIP: ${file}`);
        skippedCount++;
        continue;
      }

      const full = path.join(MIGRATIONS_DIR, file);
      const sql = await fs.readFile(full, "utf8");
      
      // Special handling for chat_whatsapp: columns already exist, skip constraint recreation
      let finalSql = sql;
      if (file === "20260718170000_chat_whatsapp.sql") {
        finalSql = normalizeSql(sql);
        if (finalSql.includes("messages_type_check")) {
          console.log(`SKIP (already applied): ${file} — columns exist, constraint already present`);
          skippedCount++;
          continue;
        }
      }

      console.log(`APPLY: ${file} (${sql.length} bytes)`);

      try {
        await client.query(sql);
        console.log(`OK: ${file}`);
        appliedCount++;
      } catch (err) {
        const msg = (err && err.message) || String(err);
        if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("pkey")) {
          console.log(`SKIP (already exists): ${file}: ${msg.split("\n")[0]}`);
          skippedCount++;
        } else {
          console.error(`FAIL: ${file}: ${msg.split("\n")[0]}`);
          failedCount++;
          throw err;
        }
      }
    }

    console.log(`\nResumo: ${appliedCount} aplicadas, ${skippedCount} ignoradas, ${failedCount} falhadas.`);
  } finally {
    await client.end();
  }
}

main();
