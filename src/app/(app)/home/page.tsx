import Link from "next/link";
import { Search } from "lucide-react";
import { PulseWordmark } from "@/components/brand/pulse-wordmark";
import { FeedList } from "@/components/feed/feed-list";
import { FeedScopeTabs } from "@/components/feed/feed-scope-tabs";
import { NotificationBell } from "@/components/nav/notification-bell";
import { requireUser } from "@/lib/auth/session";
import { countUnreadNotifications } from "@/lib/notifications/load";
import type { FeedScope } from "@/lib/posts/feed-constants";

type Props = { searchParams: Promise<{ scope?: string }> };

/** Home RSC light — ranking only via client /api/feed. */
export default async function HomePage({ searchParams }: Props) {
  const { scope: scopeParam } = await searchParams;
  const scope: FeedScope = scopeParam === "temporarias" ? "temporarias" : "all";
  const { supabase, user } = await requireUser();
  const unread = await countUnreadNotifications(supabase, user.id);
  return (
    <div className="pb-2">
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-[var(--separator)] bg-[var(--elevated)] px-4 backdrop-blur-xl backdrop-saturate-150">
        <h1 className="flex items-center">
          <PulseWordmark className="h-[18px] w-auto text-foreground" />
        </h1>
        <div className="flex items-center gap-0.5">
          <Link href="/explorar" aria-label="Explorar" className="rounded-full p-2.5 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground">
            <Search className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </Link>
          <NotificationBell initialCount={unread} />
        </div>
      </header>
      <FeedScopeTabs basePath="/home" scope={scope} />
      <FeedList key={scope} scope={scope} />
    </div>
  );
}
