import type { SupabaseClient } from "@supabase/supabase-js";

import { domainFromUrl } from "@/lib/links/urls";
import { securityLog } from "@/lib/security/log";
import {
  assertSafeOutboundUrl,
  OG_MAX_REDIRECTS,
} from "@/lib/security/ssrf";

export type LinkPreview = {
  id: string;
  post_id: string;
  url: string;
  titulo: string | null;
  imagem_url: string | null;
  dominio: string | null;
  fetched_at: string;
};

/** Fetch OG tags once. Never call this from the render path of the feed. */
export async function fetchOpenGraph(
  url: string,
  timeoutMs = 5000,
): Promise<{
  titulo: string | null;
  imagem_url: string | null;
  dominio: string;
}> {
  const dominio = domainFromUrl(url);

  const safe = await assertSafeOutboundUrl(url);
  if (!safe.ok) {
    securityLog("ssrf_blocked", { reason: safe.reason, host: dominio });
    return { titulo: null, imagem_url: null, dominio };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Manual redirect loop so each hop is re-validated (anti-SSRF)
    let current = safe.url.toString();
    let res: Response | null = null;

    for (let hop = 0; hop <= OG_MAX_REDIRECTS; hop++) {
      const hopSafe = await assertSafeOutboundUrl(current);
      if (!hopSafe.ok) {
        securityLog("ssrf_blocked", {
          reason: hopSafe.reason,
          hop,
        });
        return { titulo: null, imagem_url: null, dominio };
      }

      res = await fetch(hopSafe.url.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "PulseBot/1.0 (+https://pulse.app; link-preview)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || hop === OG_MAX_REDIRECTS) {
          return { titulo: null, imagem_url: null, dominio };
        }
        try {
          current = new URL(loc, current).toString();
        } catch {
          return { titulo: null, imagem_url: null, dominio };
        }
        continue;
      }
      break;
    }

    if (!res || !res.ok) {
      return { titulo: null, imagem_url: null, dominio };
    }

    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("text/html") && !ctype.includes("application/xhtml")) {
      return { titulo: null, imagem_url: null, dominio };
    }

    const html = (await res.text()).slice(0, 250_000);
    const titulo =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title") ||
      titleTag(html);
    let imagem =
      metaContent(html, "og:image") || metaContent(html, "twitter:image");
    if (imagem) {
      // Image URL is only stored/displayed — do not server-fetch it here.
      try {
        const imgUrl = new URL(imagem, current);
        if (imgUrl.protocol === "https:") {
          imagem = imgUrl.toString().slice(0, 1000);
        } else {
          imagem = null;
        }
      } catch {
        imagem = null;
      }
    }
    return {
      titulo: titulo?.slice(0, 200) ?? null,
      imagem_url: imagem,
      dominio: metaContent(html, "og:site_name")?.slice(0, 80) || dominio,
    };
  } catch {
    return { titulo: null, imagem_url: null, dominio };
  } finally {
    clearTimeout(timer);
  }
}

function metaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escapeRe(property)}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRe(property)}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${escapeRe(property)}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRe(property)}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtml(m[1].trim());
  }
  return null;
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return m?.[1] ? decodeHtml(m[1].trim()) : null;
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function loadLinkPreviewsForPosts(
  supabase: SupabaseClient,
  postIds: string[],
): Promise<Map<string, LinkPreview[]>> {
  const map = new Map<string, LinkPreview[]>();
  if (!postIds.length) return map;

  const { data, error } = await supabase
    .from("link_previews")
    .select("id, post_id, url, titulo, imagem_url, dominio, fetched_at")
    .in("post_id", postIds);

  if (error) {
    console.error("loadLinkPreviewsForPosts", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const p = row as LinkPreview;
    const list = map.get(p.post_id) ?? [];
    list.push(p);
    map.set(p.post_id, list);
  }
  return map;
}
