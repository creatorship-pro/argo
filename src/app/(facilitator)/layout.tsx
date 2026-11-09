import type { ReactNode } from "react";
import { StaffGate } from "@/components/staff/StaffGate";

export default function FacilitatorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <StaffGate roles={["facilitator", "admin"]}>
      <div className="flex min-h-screen flex-1 flex-col bg-zinc-950 text-zinc-50">
        {children}
      </div>
    </StaffGate>
  );
}
