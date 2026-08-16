import type { Metadata } from "next";
import Standings from "@/components/Standings";

export const metadata: Metadata = {
  title: "Standings · BEP Cipher Hunt",
};

export default function LeaderboardPage() {
  return <Standings />;
}
