import { createSign } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      return null;
    }
    // Vercel may store escaped newlines
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  } catch (e) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON parse error", e);
    return null;
  }
}

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: sa.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    }),
  );
  const unsigned = `${header}.${claim}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = base64url(sign.sign(sa.private_key));
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("No access_token from Google");
  return data.access_token;
}

/** Send FCM HTTP v1 notification to one or more device tokens. */
export async function sendFcmToTokens(input: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ ok: number; fail: number }> {
  const sa = loadServiceAccount();
  if (!sa || input.tokens.length === 0) {
    return { ok: 0, fail: 0 };
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (e) {
    console.error("FCM access token", e);
    return { ok: 0, fail: input.tokens.length };
  }

  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let ok = 0;
  let fail = 0;

  for (const token of input.tokens) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: input.title,
              body: input.body,
            },
            data: input.data ?? {},
            android: { priority: "HIGH" },
          },
        }),
      });
      if (res.ok) ok += 1;
      else {
        fail += 1;
        const text = await res.text();
        console.error("FCM send fail", res.status, text.slice(0, 300));
      }
    } catch (e) {
      fail += 1;
      console.error("FCM send error", e);
    }
  }
  return { ok, fail };
}

export async function notifyProfileDevices(
  profileId: string,
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("device_push_tokens")
    .select("token")
    .eq("profile_id", profileId);
  if (error || !data?.length) return { ok: 0, fail: 0 };
  const tokens = (data as { token: string }[])
    .map((r) => r.token)
    .filter(Boolean);
  return sendFcmToTokens({ tokens, ...payload });
}

const COPY: Record<string, (actor?: string) => { title: string; body: string }> = {
  novo_seguidor: (a) => ({
    title: "Novo seguidor",
    body: a ? `${a} começou a seguir-te` : "Alguém começou a seguir-te",
  }),
  curtida: (a) => ({
    title: "Nova curtida",
    body: a ? `${a} gostou da tua publicação` : "Alguém gostou da tua publicação",
  }),
  comentario: (a) => ({
    title: "Novo comentário",
    body: a ? `${a} comentou a tua publicação` : "Alguém comentou a tua publicação",
  }),
  mensagem: (a) => ({
    title: "Nova mensagem",
    body: a ? `${a} enviou-te uma mensagem` : "Recebeste uma mensagem",
  }),
  mencao: (a) => ({
    title: "Menção",
    body: a ? `${a} mencionou-te` : "Foste mencionado",
  }),
};

/** Fan-out FCM for a notifications row (webhook / internal). */
export async function dispatchNotificationPush(row: {
  recipient_id: string;
  type: string;
  actor_id?: string | null;
  reference_id?: string | null;
}) {
  let actorName: string | undefined;
  if (row.actor_id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = createAdminClient() as any;
      const { data } = await admin
        .from("profiles")
        .select("display_name, username")
        .eq("id", row.actor_id)
        .maybeSingle();
      actorName =
        (data?.display_name as string) || (data?.username as string) || undefined;
    } catch {
      /* ignore */
    }
  }
  const copyFn = COPY[row.type] ?? (() => ({ title: "Pulse", body: "Nova notificação" }));
  const { title, body } = copyFn(actorName);
  const data: Record<string, string> = {
    type: row.type,
  };
  if (row.reference_id) data.reference_id = row.reference_id;
  if (row.type === "curtida" || row.type === "comentario") {
    data.href = row.reference_id ? `/p/${row.reference_id}` : "/notificacoes";
  } else if (row.type === "mensagem") {
    data.href = "/mensagens";
  } else if (row.type === "novo_seguidor" && row.actor_id) {
    data.href = "/notificacoes";
  }
  return notifyProfileDevices(row.recipient_id, { title, body, data });
}
