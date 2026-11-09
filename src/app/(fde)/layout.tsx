import type { ReactNode } from "react";
import { StaffGate } from "@/components/staff/StaffGate";

// FDE screens are built for an iPad held in landscape: large, plain text and
// no hover-only controls.
export default function FdeLayout({ children }: { children: ReactNode }) {
  return (
    <StaffGate roles={["fde", "admin"]}>
      <div className="flex min-h-screen flex-1 flex-col bg-zinc-50 text-zinc-900">
        {children}
      </div>
    </StaffGate>
  );
}
