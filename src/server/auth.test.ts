import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { HttpError, hashPassword, signSession, slugify, verifyPassword, verifySession } from "./auth";

const SECRET = "unit-test-secret-with-enough-length";

beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});

describe("passwords", () => {
  it("hashes with scrypt and a fresh salt", () => {
    const a = hashPassword("correct-horse-battery");
    const b = hashPassword("correct-horse-battery");
    expect(a).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(a).not.toBe(b);
  });

  it("verifies the right password only", () => {
    const stored = hashPassword("correct-horse-battery");
    expect(verifyPassword("correct-horse-battery", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("x", "plain")).toBe(false);
    expect(verifyPassword("x", "bcrypt$salt$hash")).toBe(false);
    expect(verifyPassword("x", "scrypt$$")).toBe(false);
  });
});

describe("sessions", () => {
  const payload = { accountId: "acc_1", workspaceId: "ws_1" };

  it("round-trips through a signed token", async () => {
    const token = await signSession(payload);
    expect(token.split(".")).toHaveLength(3);
    await expect(verifySession(token)).resolves.toEqual(payload);
  });

  it("rejects tampered, foreign and expired tokens", async () => {
    const token = await signSession(payload);
    const [header, body, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "someone-else", ws: "ws_1" })).toString("base64url");
    await expect(verifySession(`${header}.${forged}.${signature}`)).resolves.toBeNull();
    await expect(verifySession(`${header}.${body}.AAAA`)).resolves.toBeNull();
    await expect(verifySession("not-a-token")).resolves.toBeNull();

    const other = new TextEncoder().encode("another-secret-that-is-long-enough");
    const foreign = await new SignJWT({ ws: "ws_1" }).setProtectedHeader({ alg: "HS256" }).setSubject("acc_1").sign(other);
    await expect(verifySession(foreign)).resolves.toBeNull();

    const secret = new TextEncoder().encode(SECRET);
    const expired = await new SignJWT({ ws: "ws_1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("acc_1")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);
    await expect(verifySession(expired)).resolves.toBeNull();
  });

  it("requires both the account and the workspace claim", async () => {
    const secret = new TextEncoder().encode(SECRET);
    const noWorkspace = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("acc_1").sign(secret);
    await expect(verifySession(noWorkspace)).resolves.toBeNull();
    const noSubject = await new SignJWT({ ws: "ws_1" }).setProtectedHeader({ alg: "HS256" }).sign(secret);
    await expect(verifySession(noSubject)).resolves.toBeNull();
  });

  it("refuses to sign without a proper secret", async () => {
    const saved = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "short";
    await expect(signSession(payload)).rejects.toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = saved;
  });
});

describe("helpers", () => {
  it("slugify strips accents and punctuation, caps the length and adds a suffix", () => {
    expect(slugify("Café Société")).toMatch(/^cafe-societe-[0-9a-f]{6}$/);
    expect(slugify("  --  ")).toMatch(/^workspace-[0-9a-f]{6}$/);
    expect(slugify("a".repeat(60))).toMatch(/^a{40}-[0-9a-f]{6}$/);
  });

  it("HttpError carries a status", () => {
    const e = new HttpError(404, "Not found");
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(404);
    expect(e.message).toBe("Not found");
  });
});
