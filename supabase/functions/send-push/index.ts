// Supabase Edge Function: send-push
//
// Triggered by a Database Webhook on INSERT into public.notifications.
// Looks up the recipient's push_subscriptions and sends a real Web
// Push (title/body/url) via VAPID, so it arrives as an OS notification
// with sound/vibration — even with the app closed.
//
// Deploy: supabase functions deploy send-push
// Secrets (set once):
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
// Then wire a Database Webhook (Dashboard → Database → Webhooks):
//   Table: notifications · Event: INSERT · Type: HTTP Request
//   URL: https://<project-ref>.functions.supabase.co/send-push
//   Header: apikey / Authorization: Bearer <anon or service_role key>

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@pulse.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const TITLES: Record<string, string> = {
  novo_seguidor: "Novo seguidor",
  curtida: "Nova curtida",
  comentario: "Novo comentário",
  mencao: "Foste mencionado",
  aprovacao_modo_profissional: "Pedido de modo profissional",
  aprovacao_verificacao: "Pedido de verificação",
};

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const row = payload.record ?? payload.new ?? payload;
    const recipientId: string | undefined = row?.recipient_id;
    const type: string | undefined = row?.type;
    if (!recipientId || !type) {
      return new Response("missing recipient_id/type", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("profile_id", recipientId);

    if (error) throw error;
    if (!subs?.length) return new Response("no subscriptions", { status: 200 });

    const title = TITLES[type] ?? "Pulse";
    const body = actorLine(row);
    const notifPayload = JSON.stringify({
      title,
      body,
      url: "/notificacoes",
      tag: type,
    });

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          notifPayload,
        ),
      ),
    );

    // Drop subscriptions the browser has invalidated (410 Gone / 404).
    const stale = results
      .map((r, i) => ({ r, sub: subs[i] }))
      .filter(
        ({ r }) =>
          r.status === "rejected" &&
          [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0),
      );
    if (stale.length) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", stale.map(({ sub }) => sub.endpoint));
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("send-push", e);
    return new Response("error", { status: 500 });
  }
});

function actorLine(row: { type?: string; actor_count?: number }): string {
  if (row.type === "curtida" && (row.actor_count ?? 1) > 1) {
    return `${row.actor_count} pessoas gostaram da tua publicação`;
  }
  return "Toca para ver.";
}
