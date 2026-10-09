import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { legalConfig } from "@nullshift/content/legal/config";
import { BookingPicker } from "../BookingPicker";
import styles from "../project.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Book a partner call | Nullshift",
  description:
    "Agencies, consultants and studios: book a 30-minute call to talk referrals, white-label builds and how Nullshift works alongside your team.",
};

export default function BookPartnerPage() {
  return (
    <>
      <Nav />
      <main className={`k-dark ${styles.page}`}>
        <div className={styles.layout}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>For agencies, studios and consultants</p>
            <h1>
              Book a partner call.
              <br />
              <span>Build more, together.</span>
            </h1>
            <p className={styles.lead}>
              Thirty minutes to talk through how Nullshift builds and runs software behind
              your clients’ brands — referrals, white-label delivery, and what a first
              project would look like.
            </p>
            <ul className={styles.promises}>
              <li>Talk directly with the people who build and run the systems.</li>
              <li>Clear commercial terms: referral fees or white-label pricing.</li>
              <li>Your clients stay yours. We work under your brand if you prefer.</li>
            </ul>
            <p className={styles.scope}>
              Not sure yet whether partnering fits? Book anyway — the call is free and
              we’ll tell you honestly if it isn’t a match.
            </p>
          </div>
          <BookingPicker kind="partner" contactEmail={legalConfig.contact.general} />
        </div>
      </main>
      <Footer />
    </>
  );
}
