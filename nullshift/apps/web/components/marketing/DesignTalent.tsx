import { TextLink } from "@/components/kyma/ui";
import { BrandBillboard } from "./BrandBillboard";
import { DesignTextReveal } from "./DesignTextReveal";
import styles from "./DesignStatement.module.css";

export function DesignTalent() {
  return (
    <section
      id="design-talent"
      aria-labelledby="design-talent-heading"
      className={`k-cream ${styles.section}`}
    >
      <DesignTextReveal className={styles.introduction}>
        <div data-design-reveal>
          <p className={styles.eyebrow}>Design talent / brand & experience</p>
          <h2 id="design-talent-heading" className={styles.headline}>
            Exceptional
            <br />
            <span>by design.</span>
          </h2>
        </div>
        <div className={styles.copy} data-design-reveal>
          <p className={styles.lead}>Powerful software. A beautiful experience.</p>
          <p className={styles.body}>
            Our designers turn complex systems into considered, intuitive interfaces. A
            premium experience for your team—and everyone you serve.
          </p>
          <p className={styles.body}>
            Your existing brand, brought to life in every screen. Or a completely new
            identity, built around you.
          </p>
          <div className={styles.link}>
            <TextLink href="/start">Talk design with us</TextLink>
          </div>
        </div>
      </DesignTextReveal>
      <BrandBillboard />
    </section>
  );
}
