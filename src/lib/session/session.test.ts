import { describe, expect, it } from "vitest";
import { canMove, nextStatus, nextStepText } from "./guest-status";
import {
  clockOffset,
  formatClock,
  remainingMs,
  segmentState,
  turnCue,
} from "./run";

describe("guest status moves", () => {
  it("allows one step forward or back, nothing else", () => {
    expect(canMove("confirmed", "arrived")).toBe(true);
    expect(canMove("arrived", "confirmed")).toBe(true);
    expect(canMove("confirmed", "intake")).toBe(false);
    expect(canMove("intake", "intake")).toBe(false);
    expect(nextStatus("closed")).toBeNull();
  });
  it("asks for consent before anything else during intake", () => {
    const base = {
      hasConsent: false,
      hasUnlockedDraft: true,
      hasDesigns: false,
      hasChoice: false,
    };
    expect(nextStepText("intake", base)).toMatch(/consent/i);
    expect(nextStepText("intake", { ...base, hasConsent: true })).toMatch(
      /read the problem back/i,
    );
  });
});

describe("timers from server end times", () => {
  it("counts down from the server's clock, not the device's", () => {
    const offset = clockOffset(10_000, 4_000); // device is 6s behind the server
    expect(remainingMs(70_000, 4_000, offset)).toBe(60_000);
    expect(remainingMs(70_000, 34_000, offset)).toBe(30_000);
  });
  it("formats and goes negative after the end", () => {
    expect(formatClock(125_000)).toBe("2:05");
    expect(formatClock(-42_000)).toBe("-0:42");
  });
  it("is due when the timer reaches zero", () => {
    expect(segmentState(null, 0, 0)).toBe("idle");
    expect(segmentState(1000, 999, 0)).toBe("running");
    expect(segmentState(1000, 1000, 0)).toBe("due");
  });
  it("gives the FDE a soft cue near the end of a five-minute turn", () => {
    expect(turnCue(0)).toBe("ok");
    expect(turnCue(4.6 * 60_000)).toBe("wrap-up");
    expect(turnCue(5 * 60_000)).toBe("over");
  });
});
