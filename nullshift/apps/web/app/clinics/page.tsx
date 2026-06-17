import type { Metadata } from "next";
import { VerticalLanding } from "@/components/marketing/VerticalLanding";
import { CLINIC } from "@nullshift/content/marketing";

export const metadata: Metadata = {
  title:
    "Own Your Practice Software — booking, records & payments for UK clinics | Nullshift",
  description:
    "Physio, osteo, chiro & private therapy clinics: stop renting per-practitioner software. A bespoke booking, records and payments system you own outright — take patient payments at a fraction, GDPR-compliant, live in weeks. Build from £2,950 + care from £49/mo.",
  alternates: { canonical: "/clinics" },
};

export default function ClinicsPage() {
  return <VerticalLanding config={CLINIC} />;
}
