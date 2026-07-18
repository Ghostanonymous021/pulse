/**
 * Unit tests for pure ranking (doc §15 + adenda).
 * Run: npm test
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyScoreModifiers,
  computeAffinity,
  computeBaseScore,
  computeEngagement,
  computeFreshness,
  computePostScore,
  filterEligibleCandidates,
  highlightMultiplier,
  shadowMultiplier,
} from "./score.ts";
import { applyAuthorSpacing } from "./spacing.ts";
import type {
  AffinitySignals,
  RankedItem,
  RankingWeights,
} from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const W = JSON.parse(
  readFileSync(join(__dirname, "../../../config/ranking.json"), "utf8"),
) as RankingWeights;

const emptyAffinity = (
  over: Partial<AffinitySignals> = {},
): AffinitySignals => ({
  following: false,
  followed_by: false,
  same_campus: false,
  same_course: false,
  same_university: false,
  likes_on_author: 0,
  comments_on_author: 0,
  messages_with_author: 0,
  profile_visits: 0,
  ...over,
});

describe("computeAffinity", () => {
  it("following > no relation", () => {
    const none = computeAffinity(emptyAffinity(), W.affinity);
    const following = computeAffinity(
      emptyAffinity({ following: true }),
      W.affinity,
    );
    assert.ok(following > none);
  });

  it("mutual follow > following only", () => {
    const one = computeAffinity(emptyAffinity({ following: true }), W.affinity);
    const mutual = computeAffinity(
      emptyAffinity({ following: true, followed_by: true }),
      W.affinity,
    );
    assert.ok(mutual > one);
  });

  it("prior interactions raise affinity", () => {
    const base = computeAffinity(
      emptyAffinity({ following: true }),
      W.affinity,
    );
    const withHistory = computeAffinity(
      emptyAffinity({
        following: true,
        comments_on_author: 3,
        likes_on_author: 5,
        messages_with_author: 2,
      }),
      W.affinity,
    );
    assert.ok(withHistory > base);
  });
});

describe("computeFreshness", () => {
  it("new post ≈ 1", () => {
    const now = new Date("2026-07-18T12:00:00Z");
    const f = computeFreshness(now, false, W, now);
    assert.ok(f > 0.99 && f <= 1);
  });

  it("decays with half-life ~36h", () => {
    const now = new Date("2026-07-18T12:00:00Z");
    const created = new Date(now.getTime() - 36 * 3600 * 1000);
    const f = computeFreshness(created, false, W, now);
    assert.ok(Math.abs(f - 0.5) < 0.02);
  });

  it("highlighted decays slower", () => {
    const now = new Date("2026-07-18T12:00:00Z");
    const created = new Date(now.getTime() - 36 * 3600 * 1000);
    const normal = computeFreshness(created, false, W, now);
    const hi = computeFreshness(created, true, W, now);
    assert.ok(hi > normal);
  });
});

describe("computeEngagement", () => {
  it("normalizes by reach — small account can beat raw counts", () => {
    const big = computeEngagement(100, 0, 1000, W);
    const small = computeEngagement(15, 0, 20, W);
    assert.ok(small > big);
  });

  it("comments weigh more than likes", () => {
    const likesOnly = computeEngagement(10, 0, 50, W);
    const commentsOnly = computeEngagement(0, 10, 50, W);
    assert.ok(commentsOnly > likesOnly);
  });
});

describe("highlightMultiplier (post-process)", () => {
  it("1.0 when not highlighted", () => {
    assert.equal(highlightMultiplier(false, 1.5), 1);
  });

  it("never exceeds teto", () => {
    assert.equal(highlightMultiplier(true, 1.5), 1.5);
  });
});

describe("shadowMultiplier (post-process)", () => {
  it("full strength below threshold", () => {
    assert.equal(shadowMultiplier(2, 3, 0.3), 1);
  });

  it("reduces when reports ≥ threshold", () => {
    assert.equal(shadowMultiplier(3, 3, 0.3), 0.3);
  });
});

describe("account-type adenda", () => {
  const now = new Date("2026-07-18T12:00:00Z");

  it("base score separate from modifiers", () => {
    const input = {
      id: "1",
      author_id: "a",
      created_at: now,
      is_highlighted: true,
      like_count: 2,
      comment_count: 0,
      author_habitual_reach: 20,
      author_open_reports: 5,
      affinity: emptyAffinity({ following: true }),
      now,
    };
    const baseOnly = computeBaseScore(input, W);
    const full = computePostScore(input, W);
    assert.equal(baseOnly.base, full.base);
    assert.ok(full.score !== full.base);
    assert.ok(full.highlight_multiplier > 1);
    assert.ok(full.shadow_multiplier < 1);
  });

  it("verified never appears — modifiers only highlight flag + reports", () => {
    const mod = applyScoreModifiers(
      { baseScore: 1, is_highlighted: false, author_open_reports: 0 },
      W,
    );
    assert.equal(mod.highlight_multiplier, 1);
    assert.equal(mod.score, 1);
  });

  it("private eligibility filters non-followers before score", () => {
    const candidates = [
      { id: "p1", author_id: "priv" },
      { id: "p2", author_id: "pub" },
      { id: "p3", author_id: "self" },
    ];
    const authors = new Map([
      ["priv", { id: "priv", is_private: true }],
      ["pub", { id: "pub", is_private: false }],
      ["self", { id: "self", is_private: true }],
    ]);
    const filtered = filterEligibleCandidates(candidates, authors, {
      id: "self",
      followingAuthorIds: new Set(),
    });
    assert.deepEqual(
      filtered.map((c) => c.id).sort(),
      ["p2", "p3"],
    );
  });

  it("private author visible when viewer follows", () => {
    const candidates = [{ id: "p1", author_id: "priv" }];
    const authors = new Map([["priv", { id: "priv", is_private: true }]]);
    const filtered = filterEligibleCandidates(candidates, authors, {
      id: "v",
      followingAuthorIds: new Set(["priv"]),
    });
    assert.equal(filtered.length, 1);
  });
});

describe("computePostScore integration", () => {
  const now = new Date("2026-07-18T12:00:00Z");

  it("new post without engagement still scores via frescor", () => {
    const b = computePostScore(
      {
        id: "1",
        author_id: "a",
        created_at: now,
        is_highlighted: false,
        like_count: 0,
        comment_count: 0,
        author_habitual_reach: 20,
        author_open_reports: 0,
        affinity: emptyAffinity({ following: true }),
        now,
      },
      W,
    );
    assert.ok(b.score > 0);
    assert.ok(b.freshness > 0.9);
    assert.equal(b.engagement, 0);
  });

  it("followed author outranks stranger with same eng/time", () => {
    const base = {
      id: "1",
      created_at: new Date(now.getTime() - 2 * 3600 * 1000),
      is_highlighted: false,
      like_count: 5,
      comment_count: 1,
      author_habitual_reach: 30,
      author_open_reports: 0,
      now,
    };
    const followed = computePostScore(
      {
        ...base,
        author_id: "f",
        affinity: emptyAffinity({ following: true }),
      },
      W,
    );
    const stranger = computePostScore(
      {
        ...base,
        id: "2",
        author_id: "s",
        affinity: emptyAffinity(),
      },
      W,
    );
    assert.ok(followed.score > stranger.score);
  });

  it("old high-engagement post loses to fresh affinity", () => {
    const oldViral = computePostScore(
      {
        id: "old",
        author_id: "x",
        created_at: new Date(now.getTime() - 14 * 24 * 3600 * 1000),
        is_highlighted: false,
        like_count: 200,
        comment_count: 40,
        author_habitual_reach: 50,
        author_open_reports: 0,
        affinity: emptyAffinity(),
        now,
      },
      W,
    );
    const freshFriend = computePostScore(
      {
        id: "new",
        author_id: "f",
        created_at: now,
        is_highlighted: false,
        like_count: 0,
        comment_count: 0,
        author_habitual_reach: 20,
        author_open_reports: 0,
        affinity: emptyAffinity({ following: true, followed_by: true }),
        now,
      },
      W,
    );
    assert.ok(freshFriend.score > oldViral.score);
  });

  it("highlight multiplies but never past teto", () => {
    const common = {
      id: "h",
      author_id: "o",
      created_at: now,
      like_count: 2,
      comment_count: 0,
      author_habitual_reach: 20,
      author_open_reports: 0,
      affinity: emptyAffinity({ following: true }),
      now,
    };
    const normal = computePostScore({ ...common, is_highlighted: false }, W);
    const hi = computePostScore({ ...common, is_highlighted: true }, W);
    assert.ok(hi.score > normal.score);
    assert.ok(hi.highlight_multiplier <= W.multiplicador_destaque_teto);
  });

  it("verified is not an input", () => {
    const a = computePostScore(
      {
        id: "1",
        author_id: "a",
        created_at: now,
        is_highlighted: false,
        like_count: 1,
        comment_count: 0,
        author_habitual_reach: 10,
        author_open_reports: 0,
        affinity: emptyAffinity({ following: true }),
        now,
      },
      W,
    );
    const b = computePostScore(
      {
        id: "2",
        author_id: "a",
        created_at: now,
        is_highlighted: false,
        like_count: 1,
        comment_count: 0,
        author_habitual_reach: 10,
        author_open_reports: 0,
        affinity: emptyAffinity({ following: true }),
        now,
      },
      W,
    );
    assert.equal(a.score, b.score);
  });
});

describe("applyAuthorSpacing", () => {
  it("breaks consecutive same-author without changing scores", () => {
    const items: RankedItem<{ id: string }>[] = [
      { item: { id: "a1" }, author_id: "A", score: 10, breakdown: emptyBd(10) },
      { item: { id: "a2" }, author_id: "A", score: 9, breakdown: emptyBd(9) },
      { item: { id: "b1" }, author_id: "B", score: 8, breakdown: emptyBd(8) },
    ];
    const out = applyAuthorSpacing(items);
    assert.equal(out[0].author_id, "A");
    assert.equal(out[1].author_id, "B");
    assert.equal(out[2].author_id, "A");
    assert.equal(out.find((x) => x.item.id === "a1")?.score, 10);
  });
});

function emptyBd(score: number) {
  return {
    affinity: 0,
    freshness: 0,
    engagement: 0,
    highlight_multiplier: 1,
    shadow_multiplier: 1,
    base: score,
    score,
  };
}
