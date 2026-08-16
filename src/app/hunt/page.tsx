import type { Metadata } from "next";
import HuntShell from "@/components/HuntShell";

export const metadata: Metadata = {
  title: "Terminal · BEP Cipher Hunt",
  robots: { index: false, follow: false },
};

export default function HuntPage() {
  return <HuntShell />;
}
