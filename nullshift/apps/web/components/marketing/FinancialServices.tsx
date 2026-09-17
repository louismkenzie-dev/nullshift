import Image from "next/image";
import { Display, Eyebrow, Lead, Section, TextLink } from "@/components/kyma/ui";
import { VaultVisual } from "./VaultVisual";
import styles from "./FinancialServices.module.css";

const FOUNDATIONS = [
  {
    number: "01",
    title: "Payments, connected.",
    body: "Stripe-powered checkout, connected to your bookings, memberships or invoices. Payment collection built into the way your business works.",
  },
  {
    number: "02",
    title: "Access, considered.",
    body: "We design your platform’s sign-in and permissions around your customers and team. The right people, with the right access.",
  },
  {
    number: "03",
    title: "Your rules. Your brand.",
    body: "A customer journey that feels like you. Bespoke booking rules, payment schedules and operational workflows, agreed around your needs.",
  },
];

export function FinancialServices() {
  return (
    <Section
      id="financial-services"
      theme="dark"
      pad="lg"
      topBorder
      className={styles.section}
    >
      <div className={styles.layout}>
        <div className={styles.copy}>
          <Eyebrow label="Payments & platform security" cursor={false} />
          <Display
            size="hero"
            className={styles.title}
            style={{ marginTop: 32, fontSize: "clamp(2.5rem, 4.7vw, 4.3rem)" }}
          >
            Secure foundations.
            <br />
            <span>[Custom]</span> by design.
          </Display>
          <Lead
            style={{
              marginTop: 28,
              maxWidth: "43ch",
              fontSize: "clamp(1.0625rem, 1.5vw, 1.2rem)",
            }}
          >
            Nullshift partners with Stripe for secure financial services. We connect
            established payment infrastructure to software built around your business.
          </Lead>
          <div className={styles.cta}>
            <TextLink href="/start">Let’s build your system</TextLink>
          </div>
        </div>

        <div className={styles.visualColumn}>
          <VaultVisual />
          <div className={styles.provider}>
            <div>
              <span className={styles.label}>Payment infrastructure</span>
              <p>Powered by Stripe.</p>
            </div>
            <a
              href="https://stripe.com/payments"
              className={styles.stripe}
              aria-label="Explore Stripe Payments"
            >
              <Image
                src="/logos/stripe-glyph-purple.svg"
                alt="Stripe"
                width={64}
                height={64}
              />
            </a>
          </div>
        </div>
      </div>

      <div className={styles.foundations}>
        {FOUNDATIONS.map((item) => (
          <div className={styles.foundation} key={item.number}>
            <span className={styles.number}>[{item.number}]</span>
            <Display as="h3" size="sm">
              {item.title}
            </Display>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        Stripe provides payment processing and payment authentication. Platform sign-in
        and permissions are designed separately by Nullshift. Features and security
        controls are agreed for each project.
      </p>
    </Section>
  );
}
