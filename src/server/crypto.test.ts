import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

describe("secrets at rest", () => {
  const previous = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = "unit-test-secret-long-enough";
  });
  afterAll(() => {
    process.env.AUTH_SECRET = previous;
  });

  it("round-trips and never repeats the ciphertext", () => {
    const a = encryptSecret("s3cret-pw ☃");
    const b = encryptSecret("s3cret-pw ☃");
    expect(a).toMatch(/^gcm\$[0-9a-f]{24}\$[0-9a-f]{32}\$[0-9a-f]+$/);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("s3cret-pw ☃");
    expect(decryptSecret(b)).toBe("s3cret-pw ☃");
    expect(decryptSecret(encryptSecret(""))).toBe("");
  });

  it("refuses tampered or foreign data", () => {
    const stored = encryptSecret("hello");
    const [algo, iv, tag, data] = stored.split("$");
    const flipped = data.replace(/^./, (c) => (c === "0" ? "1" : "0"));
    expect(() => decryptSecret([algo, iv, tag, flipped].join("$"))).toThrow(/cannot be read/);
    expect(() => decryptSecret("plain-text")).toThrow(/format/);
    process.env.AUTH_SECRET = "another-secret-long-enough";
    expect(() => decryptSecret(stored)).toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = "unit-test-secret-long-enough";
    expect(decryptSecret(stored)).toBe("hello");
  });

  it("needs AUTH_SECRET", () => {
    process.env.AUTH_SECRET = "short";
    expect(() => encryptSecret("x")).toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = "unit-test-secret-long-enough";
  });
});
