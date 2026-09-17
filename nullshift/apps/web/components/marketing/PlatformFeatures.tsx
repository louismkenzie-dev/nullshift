import { Shield, Users, UserRound, ArrowRight } from "lucide-react";
import { Display, Eyebrow, Lead, Section } from "@/components/kyma/ui";
import {
  AccessArtwork,
  AutomationArtwork,
  CareArtwork,
  CustomArtwork,
} from "./FeatureArtwork";
import styles from "./PlatformFeatures.module.css";

/**
 * Adapts the supplied Features layout: three small cards, two split wide cards.
 * Native articles replace its unavailable Card dependency; Kyma supplies tokens.
 */
export function PlatformFeatures() {
  return (
    <Section id="platform-features" theme="dark" pad="lg">
      <header className={styles.header}>
        <Eyebrow label="Built for the way you work" align="center" cursor={false} />
        <Display size="xl" style={{ marginTop: 28 }}>
          Beautiful on the surface.
          <br />
          <span className={styles.accent}>Powerful underneath.</span>
        </Display>
        <Lead style={{ margin: "24px auto 0", maxWidth: "55ch" }}>
          The tools, connections and ongoing care that turn a great interface into a
          system your business can rely on.
        </Lead>
      </header>

      <div className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.customArt} aria-hidden="true">
              <CustomArtwork />
              <span>Yours.</span>
            </div>
            <Display as="h3" size="sm" style={{ marginTop: 32 }}>
              Built for you. Owned by you.
            </Display>
            <p>
              Your workflows, your brand, your rules. Bespoke software with the code, data
              and accounts in your name.
            </p>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.ring} aria-hidden="true">
              <AccessArtwork />
            </div>
            <Display as="h3" size="sm" style={{ marginTop: 32 }}>
              Access on your terms.
            </Display>
            <p>
              Sign-in, roles and permissions designed around your business. Give your team
              and customers the access they need.
            </p>
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.automationArt} aria-hidden="true">
              <div className={styles.workflow}>
                <span>Book</span>
                <ArrowRight />
                <span>Pay</span>
                <ArrowRight />
                <span>Confirm</span>
              </div>
              <AutomationArtwork />
            </div>
            <Display as="h3" size="sm" style={{ marginTop: 32 }}>
              Less admin. More momentum.
            </Display>
            <p>
              Connect bookings, payments, reminders and records. Automate the repetitive
              work so your team can focus on people.
            </p>
          </div>
        </article>

        <article className={`${styles.card} ${styles.wideCard}`}>
          <div className={styles.split}>
            <div className={styles.wideCopy}>
              <div className={styles.smallRing} aria-hidden="true">
                <Shield size={24} strokeWidth={1} />
              </div>
              <div>
                <Display as="h3" size="sm">
                  We run it. You use it.
                </Display>
                <p>
                  Hosting, monitoring, maintenance and support through Managed Platform.
                  We look after the existing system while you run your business.
                </p>
              </div>
            </div>
            <div className={styles.monitorArt} aria-hidden="true">
              <div className={styles.windowDots}>
                <i />
                <i />
                <i />
              </div>
              <span className={styles.mono}>Platform care</span>
              <CareArtwork />
              <span className={styles.mono}>Monitor / maintain / support</span>
            </div>
          </div>
        </article>

        <article className={`${styles.card} ${styles.wideCard}`}>
          <div className={styles.split}>
            <div className={styles.wideCopy}>
              <div className={styles.smallRing} aria-hidden="true">
                <Users size={24} strokeWidth={1} />
              </div>
              <div>
                <Display as="h3" size="sm">
                  Everyone, connected.
                </Display>
                <p>
                  One joined-up system for your team and customers. Booking portals,
                  shared records and the integrations that keep everyone in sync.
                </p>
              </div>
            </div>
            <div className={styles.peopleArt} aria-hidden="true">
              {["Your team", "Your customers", "Your tools"].map((label) => (
                <div className={styles.person} key={label}>
                  <span>{label}</span>
                  <i>
                    <UserRound size={20} strokeWidth={1} />
                  </i>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>
      <p className={styles.scope}>
        Every build is scoped around your needs. Managed Platform runs it; new
        capabilities are quoted separately.
      </p>
    </Section>
  );
}
