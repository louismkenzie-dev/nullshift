import Link from "next/link";
import { DesignTextReveal } from "./DesignTextReveal";
import styles from "./ProjectCta.module.css";

const STEPS = [
  ["Your operation, understood.", "Talk through what needs to work better."],
  ["Relevant work, demonstrated.", "See examples connected to your challenges."],
  ["A clear next step.", "Establish whether we’re a fit and how to move forward."],
];

export function ProjectCta() {
  return (
    <section
      id="discuss-your-project"
      className={`k-dark ${styles.section}`}
      aria-labelledby="project-cta-heading"
    >
      <span id="book-a-demo" className={styles.anchor} aria-hidden="true" />
      <DesignTextReveal className={styles.content}>
        <p className={styles.eyebrow} data-design-reveal>
          Your next chapter
        </p>
        <h2 id="project-cta-heading" data-design-reveal>
          Your ambitions.
          <br />
          <span>Better systems behind them.</span>
        </h2>
        <p className={styles.lead} data-design-reveal>
          Bring your operational challenges, disconnected tools or next big idea. We
          design and build software around your business—and stay alongside you to run it
          and help it grow.
        </p>
        <div className={styles.action}>
          <Link href="/book" prefetch={false} className={styles.button}>
            Discuss your project <span aria-hidden="true">↗</span>
          </Link>
          <p>
            Speak directly with the Nullshift team.
            <br />
            No finished brief needed. No obligation.
          </p>
        </div>
        <ol className={styles.steps}>
          {STEPS.map(([title, description], index) => (
            <li key={title}>
              <span className={styles.number}>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </DesignTextReveal>
    </section>
  );
}
