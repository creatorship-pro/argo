"use client";

import { useParams } from "next/navigation";
import { SessionScreen } from "@/components/fde/SessionScreen";
import type { Id } from "@/lib/convex";

export default function GuestPage() {
  const { id } = useParams<{ id: string }>();
  return <SessionScreen guestId={id as Id<"guests">} />;
}
