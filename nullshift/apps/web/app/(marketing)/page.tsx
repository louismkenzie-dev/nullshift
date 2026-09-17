import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ScrollFilmHero } from "@/components/marketing/immersive/ScrollFilmHero";
import { CapabilitiesFilm } from "@/components/marketing/immersive/CapabilitiesFilm";
import { ShowcasePrototype } from "@/components/marketing/showcase/ShowcasePrototype";
import { FinancialServices } from "@/components/marketing/FinancialServices";
import { DesignTalent } from "@/components/marketing/DesignTalent";
import { PlatformFeatures } from "@/components/marketing/PlatformFeatures";
import { TrustedBy } from "@/components/marketing/TrustedBy";

export const metadata: Metadata = {
  title: "Nullshift — We build anything your business needs",
  description:
    "Bespoke business systems, designed and built around how you actually work — bookings, payments, records, people, stock, jobs. Beautiful to use, yours to own, and we run it for you.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <ScrollFilmHero />
        <div id="home-after-hero" tabIndex={-1}>
          <TrustedBy />
        </div>
        <FinancialServices />
        <DesignTalent />
        <CapabilitiesFilm />
        <PlatformFeatures />
        <article
          id="suffolk-tennis-case-study"
          tabIndex={-1}
          aria-label="Suffolk Tennis case study"
        >
          <ShowcasePrototype embedded introduction="home" />
        </article>
      </main>
      <Footer demoCta />
    </>
  );
}
