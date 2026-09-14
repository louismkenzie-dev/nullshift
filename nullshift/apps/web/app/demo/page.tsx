import type { Metadata } from "next";
import { BusinessDemo } from "@/components/marketing/demos/BusinessDemo";

export const metadata: Metadata = {
  title: "Try a fictional business system",
  description:
    "A safe, interactive booking, ticket and attendance demo. No real people, payments or client data.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <BusinessDemo />;
}
