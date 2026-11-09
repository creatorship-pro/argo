/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as capture from "../capture.js";
import type * as consent from "../consent.js";
import type * as designs from "../designs.js";
import type * as designsNode from "../designsNode.js";
import type * as events from "../events.js";
import type * as groups from "../groups.js";
import type * as guests from "../guests.js";
import type * as http from "../http.js";
import type * as lib_staff from "../lib/staff.js";
import type * as lib_validators from "../lib/validators.js";
import type * as listener from "../listener.js";
import type * as profile from "../profile.js";
import type * as proposals from "../proposals.js";
import type * as purchases from "../purchases.js";
import type * as seed from "../seed.js";
import type * as staff from "../staff.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth": typeof auth;
  "capture": typeof capture;
  "consent": typeof consent;
  "designs": typeof designs;
  "designsNode": typeof designsNode;
  "events": typeof events;
  "groups": typeof groups;
  "guests": typeof guests;
  "http": typeof http;
  "lib/staff": typeof lib_staff;
  "lib/validators": typeof lib_validators;
  "listener": typeof listener;
  "profile": typeof profile;
  "proposals": typeof proposals;
  "purchases": typeof purchases;
  "seed": typeof seed;
  "staff": typeof staff;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
