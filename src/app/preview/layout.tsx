import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// Design previews built from the worked example, with no database. Development
// only: in production these routes do not exist.
export default function PreviewLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
