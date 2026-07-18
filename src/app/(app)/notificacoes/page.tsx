import { PageHeader } from "@/components/nav/page-header";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { FollowRequestRow } from "@/components/social/follow-request-row";
import { requireUser } from "@/lib/auth/session";
import { loadNotifications } from "@/lib/notifications/load";

export const metadata = {
  title: "Notificacoes",
};

export default async function NotificacoesPage() {
  const { supabase, user } = await requireUser();

  const [pendingRes, activity] = await Promise.all([
    supabase
      .from("follows")
      .select(
        `
      follower_id,
      created_at,
      follower:profiles!follows_follower_id_fkey (
        id,
        username,
        display_name
      )
    `,
      )
      .eq("following_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    loadNotifications(supabase, user.id, 50),
  ]);

  type Row = {
    follower_id: string;
    follower:
      | { id: string; username: string; display_name: string }
      | { id: string; username: string; display_name: string }[]
      | null;
  };

  const requests = ((pendingRes.data ?? []) as unknown as Row[]).map((r) => {
    const f = Array.isArray(r.follower) ? r.follower[0] : r.follower;
    return {
      followerId: r.follower_id,
      username: f?.username ?? "user",
      displayName: f?.display_name ?? f?.username ?? "Utilizador",
    };
  });

  const empty = requests.length === 0 && activity.length === 0;

  return (
    <div className="pb-8">
      <PageHeader title="Notificacoes" backHref="/home" />

      {requests.length > 0 && (
        <section>
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="text-[13px] font-semibold">Pedidos de seguimento</h2>
            <span className="text-[12px] text-muted-foreground">
              {requests.length}
            </span>
          </div>
          <ul className="divide-y divide-[var(--separator)] border-y border-[var(--separator)]">
            {requests.map((r) => (
              <FollowRequestRow
                key={r.followerId}
                followerId={r.followerId}
                username={r.username}
                displayName={r.displayName}
              />
            ))}
          </ul>
        </section>
      )}

      {activity.length > 0 && (
        <section className={requests.length > 0 ? "mt-4" : undefined}>
          {requests.length > 0 && (
            <h2 className="px-4 py-2 text-[13px] font-semibold">Actividade</h2>
          )}
          <NotificationsList initial={activity} />
        </section>
      )}

      {empty && (
        <div className="px-4 py-14 text-center">
          <p className="text-[14px] text-muted-foreground">Sem notificacoes.</p>
        </div>
      )}
    </div>
  );
}
