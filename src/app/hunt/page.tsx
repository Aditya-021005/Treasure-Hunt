import type { Metadata } from "next";
import { redirect } from "next/navigation";
import HuntShell from "@/components/HuntShell";
import { huntOpenNow } from "@/lib/hunt";
import { hasPreviewAccess } from "@/lib/session";

export const metadata: Metadata = {
  title: "Terminal · BEP Cipher Hunt",
  robots: { index: false, follow: false },
};

/**
 * Server-side gate.
 *
 * `src/proxy.ts` runs on the edge and cannot reach the database, so it
 * only knows the window configured in the environment. This check sees
 * the admin panel's override too, which means locking the hunt from the
 * panel takes effect on the page itself and not just in the API.
 */
export default async function HuntPage() {
  if (!(await huntOpenNow()) && !(await hasPreviewAccess())) {
    redirect("/?locked=1");
  }

  return <HuntShell />;
}
