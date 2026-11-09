import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/lib/convex";
import { ProposalPage } from "@/components/proposal/ProposalPage";
import { BuyButton } from "@/components/proposal/BuyButton";
import { PaymentStatus } from "@/components/proposal/PaymentStatus";

// The token is in the URL, so keep this page out of search and out of Referer headers.
export const metadata: Metadata = {
  title: "Your proposal",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function GuestProposal({
  params,
  searchParams,
}: PageProps<"/p/[token]">) {
  return (
    <Suspense fallback={<p className="p-8 text-xl">Loading your proposal…</p>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: PageProps<"/p/[token]">["params"];
  searchParams: PageProps<"/p/[token]">["searchParams"];
}) {
  await connection();
  const { token } = await params;
  const returning = (await searchParams).checkout === "return";
  const data = await fetchQuery(api.proposals.byToken, { token }).catch(
    () => null,
  );

  // One plain message for a bad, expired or turned-off link: it says nothing about which.
  if (!data || data.status !== "ok") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-3xl font-bold">This link is not working</h1>
        <p className="mt-3 text-xl text-zinc-600">
          It may have expired or been turned off. Ask your FDE for a new one.
        </p>
      </main>
    );
  }

  return (
    <>
      <PaymentStatus returning={returning} paid={data.paid} />
      <ProposalPage
        guestName={data.guestName}
        business={data.business}
        view={data.view}
        offer={data.offer}
        readyBy={data.readyBy}
        standIn={data.stub}
        downloads={{
          json: `/p/${token}/takeaway/ai-employee.json`,
          readme: `/p/${token}/takeaway/README.md`,
        }}
        action={
          data.paid ? (
            <span className="rounded-xl bg-emerald-100 px-5 py-4 text-lg font-semibold text-emerald-900">
              Paid. Thank you.
            </span>
          ) : (
            <BuyButton token={token} purchasable={data.offer.purchasable} />
          )
        }
      />
    </>
  );
}
