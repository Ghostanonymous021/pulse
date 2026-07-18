import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  isValidUsername,
  sanitizeUsernameInput,
  usernameVariations,
} from "@/lib/auth/username";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security/client-ip";
import { securityLog } from "@/lib/security/log";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

/**
 * Public username availability (signup is unauthenticated).
 * Uses anon key + security definer RPC — no service_role.
 */
function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase public credentials");
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function isAvailable(
  supabase: ReturnType<typeof anonClient>,
  username: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_username_available", {
    p_username: username,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function GET(request: Request) {
  const ip = clientIp(request);

  const limited = rateLimit(`username-check:${ip}`, {
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!limited.ok) {
    securityLog("username_check_rate_limited", { ip });
    return NextResponse.json(
      { error: "Demasiadas tentativas." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("u") ?? searchParams.get("username") ?? "";
  const username = sanitizeUsernameInput(raw);

  if (!username || username.length < 3) {
    return NextResponse.json({
      username,
      valid: false,
      available: false,
      reason: "curto",
      suggestions: [] as string[],
    });
  }

  if (!isValidUsername(username)) {
    return NextResponse.json({
      username,
      valid: false,
      available: false,
      reason: "formato",
      suggestions: usernameVariations(username),
    });
  }

  try {
    const supabase = anonClient();
    const free = await isAvailable(supabase, username);

    if (free) {
      return NextResponse.json({
        username,
        valid: true,
        available: true,
        suggestions: [] as string[],
      });
    }

    const candidates = usernameVariations(username);
    const suggestions: string[] = [];

    for (const c of candidates) {
      if (c === username) continue;
      if (await isAvailable(supabase, c)) {
        suggestions.push(c);
      }
      if (suggestions.length >= 4) break;
    }

    let n = 1;
    while (suggestions.length < 3 && n < 200) {
      const c = `${username.slice(0, 27)}${n}`;
      n += 1;
      if (!isValidUsername(c)) continue;
      if (await isAvailable(supabase, c)) {
        suggestions.push(c);
      }
    }

    return NextResponse.json({
      username,
      valid: true,
      available: false,
      suggestions,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nao foi possivel verificar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
