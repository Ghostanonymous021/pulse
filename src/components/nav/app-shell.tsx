"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import {
  Home,
  MessageCircle,
  PlusSquare,
  User,
} from "lucide-react";

import { getChromeMode } from "@/components/nav/chrome";
import { MessagesBadge } from "@/components/nav/messages-badge";
import { RouteProgress } from "@/components/ui/route-progress";
import { cn } from "@/lib/utils";

/**
 * Shell owns the tab bar on primary tabs.
 * Prefetches primary routes for native-feel tab switches.
 */
const footerItems = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
  { href: "/postar", label: "Publicar", icon: PlusSquare },
  { href: "/perfil", label: "Perfil", icon: User },
] as const;

const PREFETCH = ["/home", "/mensagens", "/perfil", "/explorar", "/postar"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mode = getChromeMode(pathname);
  const showFooter = mode === "full";

  useEffect(() => {
    for (const href of PREFETCH) {
      try {
        router.prefetch(href);
      } catch {
        /* ignore */
      }
    }
  }, [router]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col bg-background">
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>

      <main className={cn("flex-1", showFooter && "pb-[4.5rem]")}>
        {children}
      </main>

      {showFooter && (
        <nav
          data-app-chrome
          aria-label="Principal"
          className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--separator)] bg-[var(--elevated)] backdrop-blur-xl backdrop-saturate-150"
        >
          <div className="mx-auto flex h-[56px] max-w-lg items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
            {footerItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 ease-out",
                    active
                      ? "text-brand scale-105"
                      : "text-muted-foreground hover:text-foreground active:scale-95",
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2 : 1.5} />
                  {href === "/mensagens" && <MessagesBadge />}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
