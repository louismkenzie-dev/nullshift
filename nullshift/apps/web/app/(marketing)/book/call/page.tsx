import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { legalConfig } from "@nullshift/content/legal/config";
import { BookingPicker } from "../BookingPicker";
import styles from "../project.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Book a call | Nullshift",
  description:
    "Pick a time that suits you for a free 30-minute call with the Nullshift team. No brief or account needed.",
};

export default function BookCallPage() {
  return (
    <>
      <Nav />
      <main className={`k-dark ${styles.page}`}>
        <div className={styles.layout}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>30 minutes. Free. No obligation.</p>
            <h1>
              Pick a time.
              <br />
              <span>We’ll do the rest.</span>
            </h1>
            <p className={styles.lead}>
              Choose a slot that suits you and we’ll send a calendar invite with the video
              link. Come with a rough idea, a frustration, or a finished brief — any of
              them is a good start.
            </p>
            <ul className={styles.promises}>
              <li>Speak directly with the Nullshift team.</li>
              <li>No finished brief or account needed.</li>
              <li>Cancel or rebook any time from your confirmation email.</li>
            </ul>
            <p className={styles.scope}>
              If your project needs detailed discovery, we’ll agree that scope and fee
              separately. No work starts without your approval.
            </p>
          </div>
          <BookingPicker kind="client" contactEmail={legalConfig.contact.general} />
        </div>
      </main>
      <Footer />
    </>
  );
}
