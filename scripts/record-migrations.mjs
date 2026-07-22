import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";

const { Client } = pg;

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

async function main() {
  await loadEnv(path.join(process.cwd(), ".env.local"));
  const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString: url, family: 4 });
  await client.connect();

  try {
    const applied = await client.query("SELECT filename FROM schema_migrations");
    const appliedSet = new Set(applied.rows.map(r => r.filename));
    
    let recorded = 0;
    for (const file of MISSING) {
      if (appliedSet.has(file)) continue;
      await client.query(
        "INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, now()) ON CONFLICT (filename) DO NOTHING",
        [file]
      );
      console.log(`Recorded: ${file}`);
      recorded++;
    }
    console.log(`\nRecorded ${recorded} migrations in schema_migrations.`);
  } finally {
    await client.end();
  }
}

main();
