// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import example from "../../docs/examples/hvac-followup/blueprints.json";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

// Sign-in is Better Auth's job and needs its own component. These tests stand in
// for it with a fixed "current user" and exercise everything Argo adds on top.
let currentEmail: string | undefined;
vi.mock("../../convex/auth", () => ({
  authComponent: {
    safeGetAuthUser: async () =>
      currentEmail ? { email: currentEmail } : undefined,
    registerRoutes: () => {},
  },
  createAuth: () => ({}),
  getCurrentUser: undefined,
}));

const all = import.meta.glob([
  "../../convex/**/*.ts",
  "../../convex/_generated/*.js",
]);
// Leave out type-only files; convex-test needs the rest, including _generated.
const modules = Object.fromEntries(
  Object.entries(all).filter(([k]) => !k.endsWith(".d.ts")),
);
const as = (email: string | undefined) => void (currentEmail = email);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const eventId = await ctx.db.insert("events", {
      name: "Test event",
      currentOrder: -1,
    });
    for (const [order, name] of ["Arrival", "Intake"].entries()) {
      await ctx.db.insert("segments", { eventId, order, name, minutes: 10 });
    }
    const mine = await ctx.db.insert("guests", {
      eventId,
      name: "Dana",
      business: "Eastgate",
      fdeEmail: "ana@x.com",
      status: "intake",
      createdAt: 1,
    });
    const theirs = await ctx.db.insert("guests", {
      eventId,
      name: "Sam",
      business: "Sam's",
      fdeEmail: "bo@x.com",
      status: "intake",
      createdAt: 1,
    });
    return { eventId, mine, theirs };
  });
  return { t, ...ids };
}

beforeEach(() => {
  process.env.STAFF_ALLOWLIST =
    "ana@x.com:fde,bo@x.com:fde,fac@x.com:facilitator,boss@x.com:admin";
  as(undefined);
});

describe("who can do what", () => {
  it("treats a signed-out or unlisted person as nobody", async () => {
    const { t } = await setup();
    expect(await t.query(api.staff.me)).toBeNull();
    as("stranger@x.com");
    expect(await t.query(api.staff.me)).toBeNull();
    as("ANA@x.com");
    expect(await t.query(api.staff.me)).toEqual({
      email: "ana@x.com",
      role: "fde",
    });
  });
  it("shows an FDE only their own guests", async () => {
    const { t, eventId, mine, theirs } = await setup();
    as("ana@x.com");
    const list = await t.query(api.guests.mine, { eventId });
    expect(list.map((g) => g._id)).toEqual([mine]);
    await expect(t.query(api.guests.get, { guestId: theirs })).rejects.toThrow(
      /not assigned/,
    );
  });
  it("lets facilitators and admins see everyone", async () => {
    const { t, eventId } = await setup();
    as("fac@x.com");
    expect(await t.query(api.guests.mine, { eventId })).toHaveLength(2);
  });
  it("refuses staff-only calls with no sign-in", async () => {
    const { t, eventId } = await setup();
    await expect(t.query(api.guests.mine, { eventId })).rejects.toThrow(
      /Not signed in/,
    );
  });
});

describe("consent comes before any recording", () => {
  it("refuses to start a turn, or store text, without consent", async () => {
    const { t, mine } = await setup();
    as("ana@x.com");
    await expect(
      t.mutation(api.capture.startTurn, { guestId: mine }),
    ).rejects.toThrow(/Consent/);
  });
  it("records consent once, with who and when, then allows a turn", async () => {
    const { t, mine } = await setup();
    as("ana@x.com");
    const at = await t.mutation(api.consent.record, { guestId: mine });
    expect(await t.mutation(api.consent.record, { guestId: mine })).toBe(at); // no second record
    const c = await t.query(api.consent.forGuest, { guestId: mine });
    expect(c).toMatchObject({ recordedBy: "ana@x.com", wording: "consent-v1" });
    expect(
      await t.mutation(api.capture.startTurn, { guestId: mine }),
    ).toBeTruthy();
  });
  it("stores a segment's text once even when the iPad retries it", async () => {
    const { t, mine } = await setup();
    as("ana@x.com");
    await t.mutation(api.consent.record, { guestId: mine });
    const turnId = await t.mutation(api.capture.startTurn, { guestId: mine });
    const a = await t.mutation(api.capture.addTranscript, {
      turnId,
      index: 0,
      text: "hello there",
    });
    const b = await t.mutation(api.capture.addTranscript, {
      turnId,
      index: 0,
      text: "hello there",
    });
    expect(b).toEqual(a);
    expect(await t.query(api.capture.transcriptCount, { guestId: mine })).toBe(
      1,
    );
  });
  it("will not take text for another FDE's guest", async () => {
    const { t, mine } = await setup();
    as("ana@x.com");
    await t.mutation(api.consent.record, { guestId: mine });
    const turnId = await t.mutation(api.capture.startTurn, { guestId: mine });
    as("bo@x.com");
    await expect(
      t.mutation(api.capture.addTranscript, { turnId, index: 0, text: "x" }),
    ).rejects.toThrow(/not assigned/);
  });
});

describe("read-back lock", () => {
  it("turns an inferred fact into a confirmed one in the FDE's words, and records who", async () => {
    const { t, mine } = await setup();
    const factId = await t.run((ctx) =>
      ctx.db.insert("profileFacts", {
        guestId: mine,
        text: "chases invoices",
        provenance: "inferred",
        createdAt: 1,
      }),
    );
    as("ana@x.com");
    await t.mutation(api.profile.lock, {
      factId,
      wording: "About ten hours a week chasing invoices",
    });
    const [f] = await t.query(api.profile.facts, { guestId: mine });
    expect(f).toMatchObject({
      provenance: "read-back-confirmed",
      text: "About ten hours a week chasing invoices",
      lockedBy: "ana@x.com",
    });
  });
  it("refuses another FDE", async () => {
    const { t, mine } = await setup();
    const factId = await t.run((ctx) =>
      ctx.db.insert("profileFacts", {
        guestId: mine,
        text: "x",
        provenance: "inferred",
        createdAt: 1,
      }),
    );
    as("bo@x.com");
    await expect(t.mutation(api.profile.lock, { factId })).rejects.toThrow(
      /not assigned/,
    );
  });
});

describe("run board: the facilitator confirms each phase", () => {
  it("lets only the facilitator start a segment, and stamps a server end time", async () => {
    const { t, eventId } = await setup();
    as("ana@x.com");
    await expect(
      t.mutation(api.events.startSegment, { eventId, order: 0 }),
    ).rejects.toThrow(/role/);
    as("fac@x.com");
    const before = Date.now();
    await t.mutation(api.events.startSegment, { eventId, order: 1 });
    const cur = await t.query(api.events.current);
    expect(cur?.event.currentOrder).toBe(1);
    expect(cur?.event.segmentEndsAt).toBeGreaterThanOrEqual(
      before + 10 * 60_000,
    );
  });
  it("shows one chip per FDE group, set by the FDE", async () => {
    const { t, eventId } = await setup();
    as("ana@x.com");
    await t.mutation(api.groups.setMine, { eventId, status: "needs_help" });
    as("fac@x.com");
    const board = await t.query(api.groups.board, { eventId });
    expect(board.map((g) => [g.fdeEmail, g.status])).toEqual([
      ["ana@x.com", "needs_help"],
      ["bo@x.com", "idle"],
    ]);
  });
  it("does not advance anything by itself when every guest is done", async () => {
    const { t, eventId, mine, theirs } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.patch(mine, { status: "closed" });
      await ctx.db.patch(theirs, { status: "closed" });
    });
    as("fac@x.com");
    expect((await t.query(api.events.current))?.event.currentOrder).toBe(-1);
    void eventId;
  });
  it("moves a guest one step at a time", async () => {
    const { t, mine } = await setup();
    as("ana@x.com");
    await expect(
      t.mutation(api.guests.setStatus, { guestId: mine, status: "closed" }),
    ).rejects.toThrow(/Cannot move/);
    await t.mutation(api.guests.setStatus, {
      guestId: mine,
      status: "breakout",
    });
  });
});

describe("designs and the FDE's choice", () => {
  const blueprint = JSON.parse(JSON.stringify(example));
  it("stores the choice next to the recommendation, and refuses a blocked design", async () => {
    const { t, mine } = await setup();
    const setId = await t.run(async (ctx) => {
      await ctx.db.patch(mine, { status: "breakout" }); // review happens after the breakout
      return ctx.db.insert("designSets", {
        guestId: mine,
        createdAt: 1,
        blueprint,
        generatedBy: "stub",
      });
    });
    as("ana@x.com");
    await expect(
      t.mutation(api.designs.choose, {
        designSetId: setId,
        designId: "d3-lead",
      }),
    ).rejects.toThrow(/blocked/);
    await t.mutation(api.designs.choose, {
      designSetId: setId,
      designId: "d1-drafter",
      reason: "She reads email late",
    });
    const row = await t.query(api.designs.forGuest, { guestId: mine });
    expect(row).toMatchObject({
      fdeChoice: "d1-drafter",
      fdeChoiceReason: "She reads email late",
      chosenBy: "ana@x.com",
    });
    expect(row?.blueprint.recommendation.designId).toBe("d2-coordinator");
    expect(row?.blueprint.fdeChoice).toBe("d1-drafter");
    expect((await t.query(api.guests.get, { guestId: mine })).status).toBe(
      "reviewed",
    );
  });
  it("will not build designs until something has been read back and confirmed", async () => {
    const { t, mine } = await setup();
    as("ana@x.com");
    const r = await t.action(api.designsNode.generate, { guestId: mine });
    expect(r).toMatchObject({ ok: false });
  });
  it("saves a labeled stand-in when no model key is set", async () => {
    const { t, mine } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("profileFacts", {
        guestId: mine,
        text: "x",
        provenance: "read-back-confirmed",
        createdAt: 1,
      }),
    );
    as("ana@x.com");
    delete process.env.OPENCODE_GO_API_KEY;
    delete process.env.ARGO_LLM_API_KEY;
    const r = await t.action(api.designsNode.generate, { guestId: mine });
    expect(r.ok).toBe(true);
    const row = await t.query(api.designs.forGuest, { guestId: mine });
    expect(row?.generatedBy).toBe("stub");
    expect(row?.blueprint.note).toMatch(/STAND-IN/);
  });
});

describe("guest links (the QR code)", () => {
  async function chosen() {
    const s = await setup();
    const setId = await s.t.run((ctx) =>
      ctx.db.insert("designSets", {
        guestId: s.mine,
        createdAt: 1,
        blueprint: JSON.parse(JSON.stringify(example)),
        generatedBy: "stub",
      }),
    );
    as("ana@x.com");
    await s.t.mutation(api.designs.choose, {
      designSetId: setId,
      designId: "d2-coordinator",
    });
    return s;
  }
  it("needs a chosen design first", async () => {
    const { t, mine } = await setup();
    as("ana@x.com");
    await expect(
      t.mutation(api.proposals.createLink, { guestId: mine }),
    ).rejects.toThrow(/Choose a design/);
  });
  it("opens with the token, with no sign-in, and stores only a hash", async () => {
    const { t, mine } = await chosen();
    const { token } = await t.mutation(api.proposals.createLink, {
      guestId: mine,
    });
    as(undefined); // the guest never logs in
    const page = await t.query(api.proposals.byToken, { token });
    expect(page.status).toBe("ok");
    const stored = await t.run((ctx) =>
      ctx.db.query("proposalLinks").collect(),
    );
    expect(JSON.stringify(stored)).not.toContain(token);
  });
  it("shows the guest nothing internal: no evidence panel, no catalog, no inferred facts", async () => {
    const { t, mine } = await chosen();
    const { token } = await t.mutation(api.proposals.createLink, {
      guestId: mine,
    });
    as(undefined);
    const page = await t.query(api.proposals.byToken, { token });
    const text = JSON.stringify(page);
    expect(text).not.toContain("capabilityCatalog");
    expect(text).not.toContain("tokenHash");
    expect(text).not.toContain("provenance");
  });
  it("stops working once revoked, and a new link replaces the old one", async () => {
    const { t, mine } = await chosen();
    const a = await t.mutation(api.proposals.createLink, { guestId: mine });
    const b = await t.mutation(api.proposals.createLink, { guestId: mine });
    as(undefined);
    expect(
      (await t.query(api.proposals.byToken, { token: a.token })).status,
    ).toBe("revoked");
    expect(
      (await t.query(api.proposals.byToken, { token: b.token })).status,
    ).toBe("ok");
    as("ana@x.com");
    await t.mutation(api.proposals.revoke, { guestId: mine });
    as(undefined);
    expect(
      (await t.query(api.proposals.byToken, { token: b.token })).status,
    ).toBe("revoked");
    expect(
      await t.query(api.proposals.takeaway, { token: b.token }),
    ).toBeNull();
  });
  it("stops working after it expires", async () => {
    const { t, mine } = await chosen();
    const { token } = await t.mutation(api.proposals.createLink, {
      guestId: mine,
    });
    await t.run(async (ctx) => {
      const l = (await ctx.db.query("proposalLinks").collect())[0];
      await ctx.db.patch(l._id, { expiresAt: Date.now() - 1 });
    });
    as(undefined);
    expect((await t.query(api.proposals.byToken, { token })).status).toBe(
      "expired",
    );
  });
  it("rejects a made-up token", async () => {
    const { t } = await setup();
    expect(
      (await t.query(api.proposals.byToken, { token: "x".repeat(43) })).status,
    ).toBe("unknown");
    expect(
      (await t.query(api.proposals.byToken, { token: "short" })).status,
    ).toBe("unknown");
  });
  it("lets another FDE neither open nor revoke a guest's link", async () => {
    const { t, mine } = await chosen();
    as("bo@x.com");
    await expect(
      t.mutation(api.proposals.createLink, { guestId: mine }),
    ).rejects.toThrow(/not assigned/);
    await expect(
      t.mutation(api.proposals.revoke, { guestId: mine }),
    ).rejects.toThrow(/not assigned/);
  });
  it("serves the takeaway for a live link", async () => {
    const { t, mine } = await chosen();
    const { token } = await t.mutation(api.proposals.createLink, {
      guestId: mine,
    });
    as(undefined);
    const tk = await t.query(api.proposals.takeaway, { token });
    expect(JSON.parse(tk!.json).status).toBe("designed-not-deployed");
  });
});

import { signStripePayload } from "../../src/lib/stripe/webhook";

describe("payments", () => {
  const secret = "whsec_test_secret";
  async function withLink() {
    const s = await setup();
    const setId = await s.t.run((ctx) =>
      ctx.db.insert("designSets", {
        guestId: s.mine,
        createdAt: 1,
        blueprint: JSON.parse(JSON.stringify(example)),
        generatedBy: "stub",
      }),
    );
    as("ana@x.com");
    await s.t.mutation(api.designs.choose, {
      designSetId: setId,
      designId: "d2-coordinator",
    });
    const { token } = await s.t.mutation(api.proposals.createLink, {
      guestId: s.mine,
    });
    as(undefined);
    return { ...s, token };
  }
  const event = (
    id: string,
    over: Record<string, unknown> = {},
    type = "checkout.session.completed",
  ) =>
    JSON.stringify({
      id: "evt_1",
      type,
      data: {
        object: {
          id,
          payment_status: "paid",
          amount_total: 170000,
          currency: "cad",
          ...over,
        },
      },
    });
  async function post(
    t: Awaited<ReturnType<typeof setup>>["t"],
    body: string,
    sign = true,
  ) {
    const header = sign
      ? await signStripePayload(body, secret, Math.floor(Date.now() / 1000))
      : "t=1,v1=nope";
    return t.fetch("/stripe/webhook", {
      method: "POST",
      body,
      headers: { "stripe-signature": header },
    });
  }
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
  });

  it("gives the checkout route the design and the server's own offer, only for a live link", async () => {
    const { t, token } = await withLink();
    const ctx = await t.query(api.purchases.checkoutContext, { token });
    expect(ctx).toMatchObject({
      designId: "d2-coordinator",
      purchasable: false,
      alreadyPaid: false,
    });
    expect(ctx?.offer.placeholder).toBe(true);
    expect(
      await t.query(api.purchases.checkoutContext, { token: "z".repeat(43) }),
    ).toBeNull();
  });
  it("will not record a purchase for a bad token", async () => {
    const { t } = await withLink();
    await expect(
      t.mutation(api.purchases.recordPending, {
        token: "z".repeat(43),
        sessionId: "cs_1",
      }),
    ).rejects.toThrow(/not valid/);
  });
  it("marks the purchase paid when a correctly signed event arrives, and only once", async () => {
    const { t, token, mine } = await withLink();
    await t.mutation(api.purchases.recordPending, { token, sessionId: "cs_1" });
    expect((await post(t, event("cs_1"))).status).toBe(200);
    expect((await post(t, event("cs_1"))).status).toBe(200); // Stripe may send it twice
    const rows = await t.run((ctx) => ctx.db.query("purchases").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      guestId: mine,
      status: "paid",
      amountTotal: 170000,
      currency: "cad",
      designId: "d2-coordinator",
    });
    expect((await t.query(api.proposals.byToken, { token })).status).toBe("ok");
    expect(
      (await t.query(api.purchases.checkoutContext, { token }))?.alreadyPaid,
    ).toBe(true);
  });
  it("refuses an event with a bad signature and changes nothing", async () => {
    const { t, token } = await withLink();
    await t.mutation(api.purchases.recordPending, { token, sessionId: "cs_1" });
    expect((await post(t, event("cs_1"), false)).status).toBe(400);
    expect(
      (await t.run((ctx) => ctx.db.query("purchases").collect()))[0].status,
    ).toBe("pending");
  });
  it("does not mark an unpaid session paid", async () => {
    const { t, token } = await withLink();
    await t.mutation(api.purchases.recordPending, { token, sessionId: "cs_1" });
    await post(t, event("cs_1", { payment_status: "unpaid" }));
    expect(
      (await t.run((ctx) => ctx.db.query("purchases").collect()))[0].status,
    ).toBe("pending");
  });
  it("marks an expired session expired", async () => {
    const { t, token } = await withLink();
    await t.mutation(api.purchases.recordPending, { token, sessionId: "cs_1" });
    await post(t, event("cs_1", {}, "checkout.session.expired"));
    expect(
      (await t.run((ctx) => ctx.db.query("purchases").collect()))[0].status,
    ).toBe("expired");
  });
  it("ignores a paid event for a session it never saw", async () => {
    const { t } = await withLink();
    expect((await post(t, event("cs_unknown"))).status).toBe(200);
    expect(
      await t.run((ctx) => ctx.db.query("purchases").collect()),
    ).toHaveLength(0);
  });
  it("shows the page as paid after payment", async () => {
    const { t, token } = await withLink();
    await t.mutation(api.purchases.recordPending, { token, sessionId: "cs_1" });
    await post(t, event("cs_1"));
    const page = await t.query(api.proposals.byToken, { token });
    expect(page.status === "ok" && page.paid).toBe(true);
  });
});
