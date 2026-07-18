import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertSafeOutboundUrl } from "./ssrf.ts";

describe("assertSafeOutboundUrl", () => {
  it("rejects non-https", async () => {
    const r = await assertSafeOutboundUrl("http://example.com");
    assert.equal(r.ok, false);
  });

  it("rejects localhost", async () => {
    const r = await assertSafeOutboundUrl("https://localhost/x");
    assert.equal(r.ok, false);
  });

  it("rejects private IPs", async () => {
    const r = await assertSafeOutboundUrl("https://127.0.0.1/");
    assert.equal(r.ok, false);
    const r2 = await assertSafeOutboundUrl("https://192.168.1.1/");
    assert.equal(r2.ok, false);
    const r3 = await assertSafeOutboundUrl("https://169.254.169.254/latest");
    assert.equal(r3.ok, false);
  });

  it("allows public https host", async () => {
    const r = await assertSafeOutboundUrl("https://example.com/page");
    assert.equal(r.ok, true);
  });
});
