import { ExternalLink } from "lucide-react";

import type { LinkPreview } from "@/lib/links/preview";
import { domainFromUrl } from "@/lib/links/urls";

/** Quiet OG card under post body — no heavy shadow, no accent chrome. */
export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  const domain = preview.dominio || domainFromUrl(preview.url);
  const title = preview.titulo || domain;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block overflow-hidden rounded-[14px] border border-[var(--separator)] bg-card transition-colors hover:bg-muted/40"
    >
      {preview.imagem_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.imagem_url}
          alt=""
          className="aspect-[1.91/1] w-full object-cover bg-muted"
        />
      )}
      <div className="flex items-start gap-2 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-muted-foreground">{domain}</p>
          <p className="mt-0.5 line-clamp-2 text-[14px] font-medium leading-snug tracking-[-0.01em]">
            {title}
          </p>
        </div>
        <ExternalLink
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          strokeWidth={1.5}
        />
      </div>
    </a>
  );
}
