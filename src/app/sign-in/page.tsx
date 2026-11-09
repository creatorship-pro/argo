"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

// Skeleton of the staff email-code sign-in. Ticket E3 replaces this with the
// real flow (staff allowlist, roles, QR guest access).
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    if (error) setMessage(error.message ?? "Could not send the code.");
    else {
      setCodeSent(true);
      setMessage(null);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    setMessage(
      error ? (error.message ?? "That code did not work.") : "Signed in.",
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold">Staff sign in</h1>
      <form
        onSubmit={codeSent ? verifyCode : sendCode}
        className="flex flex-col gap-3"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={codeSent}
          className="rounded border border-zinc-300 px-3 py-2 text-lg"
        />
        {codeSent && (
          <input
            inputMode="numeric"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Code"
            className="rounded border border-zinc-300 px-3 py-2 text-lg"
          />
        )}
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-2 text-lg text-white"
        >
          {codeSent ? "Sign in" : "Send code"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
