import { describe, expect, it } from "vitest";
import { DEFAULT_INSTANCE, REGISTRATION_POLICIES, describeRegistration, emailDomain, isRegistrationPolicy, parseDomains, registrationAllowed } from "./registration";

describe("registration policy", () => {
  it("emailDomain and parseDomains normalise", () => {
    expect(emailDomain("Ada@Example.COM ")).toBe("example.com");
    expect(emailDomain("nope")).toBe("");
    expect(parseDomains("Acme.com, @cliente.it ; foo/ acme.com\n")).toEqual(["acme.com", "cliente.it", "foo"]);
    expect(parseDomains("")).toEqual([]);
  });

  it("open lets anyone in, invited only invited people", () => {
    expect(registrationAllowed(DEFAULT_INSTANCE, "x@y.z", false)).toEqual({ ok: true });
    const invited = { registration: "invited" as const, domains: [] };
    expect(registrationAllowed(invited, "x@y.z", false).ok).toBe(false);
    expect(registrationAllowed(invited, "x@y.z", true)).toEqual({ ok: true });
  });

  it("domains allow listed domains and their subdomains, invited people always", () => {
    const s = { registration: "domains" as const, domains: ["acme.com"] };
    expect(registrationAllowed(s, "ada@acme.com", false)).toEqual({ ok: true });
    expect(registrationAllowed(s, "ada@dev.acme.com", false)).toEqual({ ok: true });
    expect(registrationAllowed(s, "ada@notacme.com", false).ok).toBe(false);
    expect(registrationAllowed(s, "ada@gmail.com", true)).toEqual({ ok: true });
    const r = registrationAllowed(s, "ada@gmail.com", false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("@acme.com");
    expect(registrationAllowed({ registration: "domains", domains: [] }, "a@b.c", false).ok).toBe(false);
  });

  it("describes the policy for the register page", () => {
    expect(describeRegistration(DEFAULT_INSTANCE)).toBeNull();
    expect(describeRegistration({ registration: "invited", domains: [] })).toMatch(/invitation only/);
    expect(describeRegistration({ registration: "domains", domains: ["a.it", "b.it"] })).toContain("@a.it, @b.it");
    expect(describeRegistration({ registration: "domains", domains: [] })).toMatch(/invitation only/);
  });

  it("knows its policies", () => {
    expect(REGISTRATION_POLICIES.map((p) => p.id)).toEqual(["open", "invited", "domains"]);
    expect(isRegistrationPolicy("open")).toBe(true);
    expect(isRegistrationPolicy("closed")).toBe(false);
  });
});
