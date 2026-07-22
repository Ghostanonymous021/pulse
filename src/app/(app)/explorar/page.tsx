import Link from "next/link";

import { UserAvatar } from "@/components/profile/user-avatar";
import { SearchBar } from "@/components/social/search-bar";
import { VerifiedBadge } from "@/components/social/verified-badge";
import { requireUser } from "@/lib/auth/session";
import {
  isVerificationActive,
  verificationBadgeType,
} from "@/lib/settings/verification";
import type { Profile } from "@/types/database";

/**
 * Instagram search dual-mode: Contas | Publicacoes (doc §9.3).
 * Private accounts appear; content gated by RLS/follow.
 *
 * Verified accounts get sort priority here only — NEVER in feed ranking.
 */
export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q = "", tab = "contas" } = await searchParams;
  const query = q.trim().replace(/[%_,]/g, " ").slice(0, 80);
  const active = tab === "publicacoes" ? "publicacoes" : "contas";
  const { supabase } = await requireUser();
  const pattern = `%${query}%`;

  let accounts: Profile[] = [];
  let posts: {
    id: string;
    body: string | null;
    created_at: string;
    author: {
      username: string;
      display_name: string;
      account_type?: Profile["account_type"];
      is_verified?: boolean;
      verified_type?: Profile["verified_type"];
      verification_expires_at?: string | null;
    } | null;
  }[] = [];

  if (query.length >= 1) {
    if (active === "contas") {
      // search_profiles (see supabase/migrations/20260722200100_search_profiles_fn.sql)
      // ranks with pg_trgm similarity() in the database — tolerates typos
      // and missing diacritics ("malony" still finds "Mallony"), which a
      // plain ILIKE substring match cannot. Falls back to the old ILIKE
      // path only if the RPC is unreachable, so search never goes fully
      // dark on a transient RPC error.
      const { data, error } = await supabase.rpc("search_profiles", {
        p_query: query,
        p_limit: 60,
      });
      if (error) {
        const fallback = await supabase
          .from("profiles")
          .select("*")
          .or(
            `username.ilike.${pattern},display_name.ilike.${pattern},university.ilike.${pattern},campus.ilike.${pattern},course.ilike.${pattern}`,
          )
          .limit(60);
        accounts = rankAccountsByRelevance(
          (fallback.data ?? []) as Profile[],
          query,
        );
      } else {
        accounts = (data ?? []) as Profile[];
      }
    } else {
      const { data } = await supabase
        .from("posts")
        .select(
          `
          id,
          body,
          created_at,
          author:profiles!posts_author_id_fkey (
            username, display_name, account_type, is_verified, verified_type, verification_expires_at
          )
        `,
        )
        .ilike("body", pattern)
        .order("created_at", { ascending: false })
        .limit(30);

      posts = (data ?? []).map((row) => {
        const author = Array.isArray(row.author)
          ? row.author[0]
          : row.author;
        return {
          id: row.id as string,
          body: row.body as string | null,
          created_at: row.created_at as string,
          author: author as {
            username: string;
            display_name: string;
            account_type?: Profile["account_type"];
            is_verified?: boolean;
            verified_type?: Profile["verified_type"];
            verification_expires_at?: string | null;
          } | null,
        };
      });
    }
  } else if (active === "contas") {
    // Empty query: Discover strip — verified first (not feed ranking)
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_verified", true)
      .order("verified_at", { ascending: false })
      .limit(20);
    accounts = sortAccountsForExplore((data ?? []) as Profile[]);
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 border-b border-[var(--separator)] bg-[var(--elevated)] backdrop-blur-xl">
        <SearchBar defaultValue={query} tab={active} />
        <div className="mt-2 grid grid-cols-2 text-center text-[14px] font-medium">
          <Link
            href={`/explorar?q=${encodeURIComponent(query)}&tab=contas`}
            className={
              active === "contas"
                ? "border-b-2 border-foreground py-2.5"
                : "border-b-2 border-transparent py-2.5 text-muted-foreground"
            }
          >
            Contas
          </Link>
          <Link
            href={`/explorar?q=${encodeURIComponent(query)}&tab=publicacoes`}
            className={
              active === "publicacoes"
                ? "border-b-2 border-foreground py-2.5"
                : "border-b-2 border-transparent py-2.5 text-muted-foreground"
            }
          >
            Publicacoes
          </Link>
        </div>
      </div>

      {!query && active === "contas" && accounts.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Pessoas, organizacoes e publicacoes.
        </p>
      )}

      {!query && active === "contas" && accounts.length > 0 && (
        <p className="px-4 pt-4 text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Contas verificadas
        </p>
      )}

      {!query && active === "publicacoes" && (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Pesquisa por texto nas publicacoes.
        </p>
      )}

      {(query || accounts.length > 0) && active === "contas" && (
        <ul className="divide-y divide-border">
          {query && accounts.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Sem resultados.
            </li>
          )}
          {accounts.map((a) => {
            const meta = [a.university, a.campus, a.course]
              .filter(Boolean)
              .join(" · ");
            const verified = isVerificationActive(a);
            return (
              <li key={a.id}>
                <Link
                  href={`/u/${a.username}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <UserAvatar
                    userId={a.id}
                    avatarUrl={a.avatar_url}
                    name={a.display_name || a.username}
                    size={44}
                  />
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold">
                      <span className="truncate">
                        {a.display_name || a.username}
                      </span>
                      {verified && (
                        <VerifiedBadge
                          accountType={verificationBadgeType(a)}
                          size="sm"
                        />
                      )}
                      {a.is_private ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          privada
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{a.username}
                      {a.account_type === "organizacao" ? " · Organização" : ""}
                    </p>
                    {meta && (
                      <p className="truncate text-xs text-muted-foreground">
                        {meta}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {query && active === "publicacoes" && (
        <ul className="divide-y divide-border">
          {posts.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Sem resultados.
            </li>
          )}
          {posts.map((p) => {
            const verified = p.author
              ? isVerificationActive(p.author)
              : false;
            return (
              <li key={p.id}>
                <Link
                  href={`/p/${p.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <span>
                      {p.author?.display_name || p.author?.username || "—"}
                    </span>
                    {verified && p.author && (
                      <VerifiedBadge
                        accountType={verificationBadgeType(p.author)}
                        size="sm"
                      />
                    )}
                    {p.author?.username ? (
                      <span> · @{p.author.username}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm">
                    {p.body || "Publicacao com media"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Verified first, then orgs, then alphabetical — empty-query Discover strip only. */
function sortAccountsForExplore(list: Profile[]) {
  return [...list].sort((a, b) => {
    const av = isVerificationActive(a) ? 1 : 0;
    const bv = isVerificationActive(b) ? 1 : 0;
    if (bv !== av) return bv - av;
    const ao = a.account_type === "organizacao" ? 1 : 0;
    const bo = b.account_type === "organizacao" ? 1 : 0;
    if (bo !== ao) return bo - ao;
    return (a.display_name || a.username).localeCompare(
      b.display_name || b.username,
      "pt",
    );
  });
}

/**
 * Relevance ranking for a text query — replaces the previous behaviour
 * of just handing back whatever order Postgres returned an OR'd ILIKE
 * in (effectively insertion order, so a search for "ana" could surface
 * someone whose *campus* merely contains "ana" above the account
 * actually named Ana). Scored the way every real search box does it:
 * exact match > starts-with > word-boundary match > any-substring,
 * evaluated on username first (what people actually type), then name,
 * then the looser campus/university/course fields. Verified accounts
 * keep their existing tiebreaker boost — never a ranking override.
 */
function rankAccountsByRelevance(list: Profile[], rawQuery: string): Profile[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return list;

  function fieldScore(value: string | null | undefined, weight: number): number {
    if (!value) return 0;
    const v = value.toLowerCase();
    if (v === q) return weight * 4;
    if (v.startsWith(q)) return weight * 3;
    if (new RegExp(`\\b${escapeRegex(q)}`).test(v)) return weight * 2;
    if (v.includes(q)) return weight;
    return 0;
  }

  return [...list]
    .map((p) => {
      const score =
        fieldScore(p.username, 100) +
        fieldScore(p.display_name, 80) +
        fieldScore(p.campus, 20) +
        fieldScore(p.course, 15) +
        fieldScore(p.university, 10) +
        (isVerificationActive(p) ? 2 : 0);
      return { p, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.p.display_name || a.p.username).localeCompare(
        b.p.display_name || b.p.username,
        "pt",
      );
    })
    .map((r) => r.p);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
