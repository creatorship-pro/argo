import { PROVENANCE_LABEL } from "@/lib/profile/facts";

const PROV_STYLE: Record<string, string> = {
  inferred: "bg-amber-100 text-amber-900 ring-amber-400",
  said: "bg-sky-100 text-sky-900 ring-sky-400",
  "read-back-confirmed": "bg-emerald-100 text-emerald-900 ring-emerald-500",
  "fde-approved": "bg-emerald-100 text-emerald-900 ring-emerald-500",
};

export function ProvenanceTag({ p }: { p: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-base font-semibold ring-1 ${PROV_STYLE[p]}`}
    >
      {PROVENANCE_LABEL[p as keyof typeof PROVENANCE_LABEL]}
    </span>
  );
}
