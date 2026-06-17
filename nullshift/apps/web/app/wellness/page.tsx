import type { Metadata } from "next";
import { VerticalLanding } from "@/components/marketing/VerticalLanding";
import { WELLNESS } from "@nullshift/content/marketing";

export const metadata: Metadata = {
  title: "Zero No-Show — Booking systems for salons, clinics & gyms | Nullshift",
  description:
    "Cut no-shows by up to 85% and fill your calendar while you sleep. Bespoke booking site + deposits, automated reminders, waitlist auto-fill and rebooking. Live in weeks, you own it, from £129/mo.",
};

export default function WellnessPage() {
  return <VerticalLanding config={WELLNESS} />;
}
