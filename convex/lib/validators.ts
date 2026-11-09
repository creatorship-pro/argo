import { v } from "convex/values";

export const guestStatus = v.union(
  v.literal("confirmed"),
  v.literal("arrived"),
  v.literal("intake"),
  v.literal("breakout"),
  v.literal("reviewed"),
  v.literal("proposed"),
  v.literal("closed"),
);

export const groupStatus = v.union(
  v.literal("idle"),
  v.literal("recording"),
  v.literal("awaiting_review"),
  v.literal("ready"),
  v.literal("needs_help"),
);

export const provenance = v.union(
  v.literal("said"),
  v.literal("read-back-confirmed"),
  v.literal("inferred"),
  v.literal("fde-approved"),
);

export const checklistKey = v.union(
  v.literal("problem"),
  v.literal("frequency"),
  v.literal("duration"),
  v.literal("who"),
  v.literal("cost"),
  v.literal("tools"),
  v.literal("constraints"),
  v.literal("success"),
);
