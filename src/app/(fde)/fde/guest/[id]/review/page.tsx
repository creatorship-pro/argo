"use client";

import { useParams } from "next/navigation";
import { ReviewScreen } from "@/components/fde/ReviewScreen";
import type { Id } from "@/lib/convex";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  return <ReviewScreen guestId={id as Id<"guests">} />;
}
