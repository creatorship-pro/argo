"use client";

import { useParams } from "next/navigation";
import { PresentScreen } from "@/components/fde/PresentScreen";
import type { Id } from "@/lib/convex";

export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  return <PresentScreen guestId={id as Id<"guests">} />;
}
