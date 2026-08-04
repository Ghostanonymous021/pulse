import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FEED_HARD_TTL_MS, FEED_SOFT_TTL_MS, feedFreshness } from "./feed-constants.ts";
describe("feedFreshness", () => {
  it("soft", () => {
    const now = 1_000_000;
    assert.equal(feedFreshness(now - 1_000, now), "soft");
  });
  it("hard", () => {
    const now = 1_000_000;
    assert.equal(feedFreshness(now - FEED_SOFT_TTL_MS, now), "hard");
  });
  it("expired", () => {
    const now = 1_000_000;
    assert.equal(feedFreshness(now - FEED_HARD_TTL_MS - 1, now), "expired");
  });
  it("ttl", () => {
    assert.ok(FEED_SOFT_TTL_MS >= 60_000);
  });
});
