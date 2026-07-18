import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyMention,
  extractMentionUsernames,
  getActiveMention,
} from "./active.ts";

describe("getActiveMention", () => {
  it("detects @ at start", () => {
    const a = getActiveMention("@jo", 3);
    assert.ok(a);
    assert.equal(a!.query, "jo");
    assert.equal(a!.start, 0);
  });

  it("detects after space", () => {
    const a = getActiveMention("ola @ma", 7);
    assert.ok(a);
    assert.equal(a!.query, "ma");
  });

  it("ignores email-like mid token", () => {
    const a = getActiveMention("x@y", 3);
    assert.equal(a, null);
  });

  it("null when no @", () => {
    assert.equal(getActiveMention("hello", 5), null);
  });
});

describe("applyMention", () => {
  it("replaces query and adds space", () => {
    const active = getActiveMention("oi @jo", 6)!;
    const r = applyMention("oi @jo", active, "jose");
    assert.equal(r.text, "oi @jose ");
  });
});

describe("extractMentionUsernames", () => {
  it("finds unique handles", () => {
    const u = extractMentionUsernames("ola @a e @b e @a");
    assert.deepEqual(u, ["a", "b"]);
  });
});
