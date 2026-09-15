import type { Metadata } from "next";
import HuntShell from "@/components/HuntShell";

export const metadata: Metadata = {
  title: "The Descent · BEP Cipher Hunt",
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
  return <HuntShell />;
}
