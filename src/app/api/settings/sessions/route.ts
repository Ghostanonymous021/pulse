import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export type SessionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  user_agent: string | null;
  ip: string | null;
  is_current: boolean;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  const ua = request.headers.get("user-agent");
  const listed = await listSessionsFromDb(user.id);
  if (listed && listed.length > 0) return NextResponse.json({ sessions: listed });
  return NextResponse.json({
    sessions: [{
      id: "current",
      created_at: user.created_at,
      updated_at: user.last_sign_in_at ?? user.created_at,
      user_agent: ua,
      ip: null,
      is_current: true,
    } satisfies SessionRow],
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

async function listSessionsFromDb(userId: string): Promise<SessionRow[] | null> {
  const url = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL || null;
  if (!url) return null;
  try {
    const { Client } = await import("pg");
    const ca = process.env.DATABASE_SSL_CA;
    const ssl = ca
      ? { rejectUnauthorized: true, ca }
      : process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true"
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false };
    const client = new Client({ connectionString: url, ssl });
    await client.connect();
    const result = await client.query(
      `select id::text, created_at, updated_at, user_agent, ip::text as ip
       from auth.sessions where user_id = $1::uuid
       order by updated_at desc limit 20`,
      [userId],
    );
    await client.end();
    const rows = result.rows as {
      id: string; created_at: Date | string; updated_at: Date | string;
      user_agent: string | null; ip: string | null;
    }[];
    return rows.map((r, i) => ({
      id: String(r.id),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
      user_agent: r.user_agent,
      ip: r.ip,
      is_current: i === 0,
    }));
  } catch {
    return null;
  }
}
