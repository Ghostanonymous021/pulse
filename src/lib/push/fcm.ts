/**
 * Send FCM data/notification to device tokens.
 * Prefer FIREBASE_SERVER_KEY (legacy) for simple server setups.
 * Production should migrate to FCM HTTP v1 + service account.
 */
export async function sendFcmToTokens(input: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ ok: number; fail: number }> {
  const key = process.env.FIREBASE_SERVER_KEY;
  if (!key || input.tokens.length === 0) {
    return { ok: 0, fail: 0 };
  }

  let ok = 0;
  let fail = 0;
  // Legacy HTTP API — one-by-one for simplicity (MVP). Batch later.
  for (const token of input.tokens) {
    try {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token,
          notification: {
            title: input.title,
            body: input.body,
          },
          data: input.data ?? {},
          priority: "high",
        }),
      });
      if (res.ok) ok += 1;
      else fail += 1;
    } catch {
      fail += 1;
    }
  }
  return { ok, fail };
}

export async function notifyProfileDevices(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  profileId: string,
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  const { data, error } = await supabaseAdmin
    .from("device_push_tokens")
    .select("token")
    .eq("profile_id", profileId);
  if (error || !data?.length) return { ok: 0, fail: 0 };
  const tokens = data.map((r: { token: string }) => r.token).filter(Boolean);
  return sendFcmToTokens({ tokens, ...payload });
}
