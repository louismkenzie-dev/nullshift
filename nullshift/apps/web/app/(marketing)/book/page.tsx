import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { hasSupabaseServerConfig } from "@nullshift/db/env";
import { legalConfig } from "@nullshift/content/legal/config";
import { projectCalendarUrl } from "@/lib/projectEnquiry";
import { ProjectEnquiryForm } from "./ProjectEnquiryForm";
import styles from "./project.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Discuss your project | Nullshift",
  description:
    "Speak directly with the Nullshift team, with no account or finished brief required.",
};

export default function BookPage() {
  return (
    <>
      <Nav />
      <main className={`k-dark ${styles.page}`}>
        <div className={styles.layout}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>A conversation. Not a commitment.</p>
            <h1>
              Your next chapter.
              <br />
              <span>Let’s build it.</span>
            </h1>
            <p className={styles.lead}>
              Tell us what needs to work better. We’ll explore where custom software could
              make a difference—and whether Nullshift is the right team to build it.
            </p>
            <ul className={styles.promises}>
              <li>Speak directly with the Nullshift team.</li>
              <li>No finished brief or account needed.</li>
              <li>Your first conversation is free, with no obligation.</li>
            </ul>
            <p className={styles.scope}>
              If your project needs detailed discovery, we’ll agree that scope and fee
              separately. No work starts without your approval.
            </p>
          </div>
          <ProjectEnquiryForm
            calendarUrl={projectCalendarUrl(process.env.NEXT_PUBLIC_CAL_LINK)}
            preview={process.env.NODE_ENV === "development" && !hasSupabaseServerConfig()}
            contactEmail={legalConfig.contact.general}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
