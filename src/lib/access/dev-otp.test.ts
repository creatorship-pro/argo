import { describe, expect, it } from "vitest";
import { devFixedOtp } from "./dev-otp";

const env = { DEV_FIXED_OTP: "123456", STAFF_ALLOWLIST: "ana@x.com:fde" };

describe("devFixedOtp", () => {
  it("is off unless the variable is set", () => {
    expect(
      devFixedOtp(
        { email: "ana@x.com", type: "sign-in" },
        { STAFF_ALLOWLIST: env.STAFF_ALLOWLIST },
      ),
    ).toBeUndefined();
  });
  it("gives allowlisted staff the fixed code, case-insensitively", () => {
    expect(devFixedOtp({ email: "Ana@X.com", type: "sign-in" }, env)).toBe(
      "123456",
    );
  });
  it("leaves everyone else on a random code", () => {
    expect(
      devFixedOtp({ email: "eve@x.com", type: "sign-in" }, env),
    ).toBeUndefined();
  });
  it("only applies to sign-in", () => {
    expect(
      devFixedOtp({ email: "ana@x.com", type: "forget-password" }, env),
    ).toBeUndefined();
  });
  it("ignores a value that is not six digits", () => {
    expect(
      devFixedOtp(
        { email: "ana@x.com", type: "sign-in" },
        { ...env, DEV_FIXED_OTP: "12" },
      ),
    ).toBeUndefined();
  });
});
