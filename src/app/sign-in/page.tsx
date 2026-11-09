"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

// Staff sign in with a six-digit code sent to their email. Only emails on the
// staff list get a code, but the form says the same thing either way.
export default function SignInPage() {
  const router = useRouter();
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
    if (error) setMessage("Could not send a code. Try again in a moment.");
    else {
      setCodeSent(true);
      setMessage("If that email is on the staff list, a code is on its way.");
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    if (error)
      setMessage("That code did not work. Check it, or ask for a new one.");
    else router.push("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-6 py-24">
      <h1 className="text-4xl font-bold">Staff sign in</h1>
      <form
        onSubmit={codeSent ? verifyCode : sendCode}
        className="flex flex-col gap-4"
      >
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={codeSent}
          aria-label="Email"
          className="rounded-xl border border-zinc-300 px-4 py-4 text-2xl"
        />
        {codeSent && (
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            aria-label="Code"
            className="rounded-xl border border-zinc-300 px-4 py-4 text-3xl tracking-widest"
          />
        )}
        <button
          type="submit"
          className="min-h-16 rounded-xl bg-zinc-900 px-4 text-2xl font-semibold text-white"
        >
          {codeSent ? "Sign in" : "Send code"}
        </button>
      </form>
      {message && (
        <p role="status" className="text-xl text-zinc-700">
          {message}
        </p>
      )}
    </main>
  );
}
