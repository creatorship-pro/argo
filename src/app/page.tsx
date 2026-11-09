import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Argo</h1>
      <p className="max-w-md text-lg text-zinc-600">
        Event software for The Overhang. Staff sign in below. Guests open the
        private link or QR code they were given.
      </p>
      <div className="flex gap-3">
        <Link
          href="/fde"
          className="rounded-xl bg-zinc-900 px-6 py-4 text-xl text-white"
        >
          FDE screens
        </Link>
        <Link
          href="/facilitator"
          className="rounded-xl bg-zinc-200 px-6 py-4 text-xl"
        >
          Run board
        </Link>
      </div>
    </main>
  );
}
