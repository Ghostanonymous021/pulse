import Link from "next/link";

import type { FeedScope } from "@/lib/posts/feed";
import { cn } from "@/lib/utils";

/**
 * Discreto filtro "Todas / Temporárias" — mesmo padrão visual das abas
 * de Explorar (Contas | Publicações): sublinhado, sem pílulas, sem ícones.
 * Único filtro permitido pela visão de produto (nada de categorias).
 */
export function FeedScopeTabs({
  basePath,
  scope,
}: {
  basePath: string;
  scope: FeedScope;
}) {
  return (
    <div className="grid grid-cols-2 border-b border-[var(--separator)] text-center text-[13.5px] font-medium">
      <Link
        href={basePath}
        className={cn(
          "border-b-2 py-2",
          scope === "all"
            ? "border-foreground text-foreground"
            : "border-transparent text-muted-foreground",
        )}
      >
        Todas
      </Link>
      <Link
        href={`${basePath}?scope=temporarias`}
        className={cn(
          "border-b-2 py-2",
          scope === "temporarias"
            ? "border-foreground text-foreground"
            : "border-transparent text-muted-foreground",
        )}
      >
        Temporárias
      </Link>
    </div>
  );
}
