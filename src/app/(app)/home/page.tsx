import Link from "next/link";
import { Search } from "lucide-react";

import { FeedList } from "@/components/feed/feed-list";
import { NotificationBell } from "@/components/nav/notification-bell";
import { requireUser } from "@/lib/auth/session";
import { countUnreadNotifications } from "@/lib/notifications/load";
import { FEED_PAGE_SIZE, loadFeedPage } from "@/lib/posts/feed";

export default async function HomePage() {
  const { supabase, user } = await requireUser();
  const [page, unread] = await Promise.all([
    loadFeedPage(supabase, user.id, { limit: FEED_PAGE_SIZE, offset: 0 }),
    countUnreadNotifications(supabase, user.id),
  ]);

  return (
    <div className="pb-2">
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-[var(--separator)] bg-[var(--elevated)] px-4 backdrop-blur-xl backdrop-saturate-150">
        <h1 className="text-[17px] font-semibold tracking-[-0.03em]">Pulse</h1>
        <div className="flex items-center gap-0.5">
          <Link
            href="/explorar"
            aria-label="Explorar"
            className="rounded-full p-2.5 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </Link>
          <NotificationBell initialCount={unread} />
        </div>
      </header>

      <FeedList
        initialPosts={page.posts}
        initialNextOffset={page.nextOffset}
      />
    </div>
  );
}
