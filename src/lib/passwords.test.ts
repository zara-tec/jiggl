import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, generatePassword } from "./passwords";

describe("generatePassword", () => {
  it("is long enough, readable and different every time", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p).toMatch(/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/);
      expect(p).not.toMatch(/[01IlO]/);
      expect(p.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
      seen.add(p);
    }
    expect(seen.size).toBe(50);
  });
});
