import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PASSWORD_MIN_LENGTH, validatePassword } from "./password.ts";

describe("validatePassword", () => {
  it("rejects short passwords", () => {
    assert.ok(validatePassword("short"));
    assert.ok(validatePassword("123456789")); // 9
  });

  it("accepts long enough uncommon passwords", () => {
    assert.equal(validatePassword("correct horse"), null);
    assert.equal(validatePassword("x".repeat(PASSWORD_MIN_LENGTH)), null);
  });

  it("rejects common blocklist", () => {
    assert.ok(validatePassword("password123"));
    assert.ok(validatePassword("1234567890"));
  });

  it("rejects pure short digits", () => {
    assert.ok(validatePassword("1234567890")); // 10 digits
  });
});
