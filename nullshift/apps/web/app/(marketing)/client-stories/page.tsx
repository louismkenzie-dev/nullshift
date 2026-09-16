import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ShowcasePrototype } from "@/components/marketing/showcase/ShowcasePrototype";
import styles from "./stories.module.css";

export const metadata: Metadata = {
  title: "Client stories — Nullshift",
  description:
    "Explore the systems we build, run and grow. Start with Suffolk Tennis: one connected platform for administrators and parents, shown with fictional demo data.",
  alternates: { canonical: "/client-stories" },
};

export default function ClientStoriesPage() {
  return (
    <>
      <Nav tone="cream" />
      <main className={styles.page}>
        <section className={styles.cover} aria-labelledby="stories-title">
          <p className={styles.eyebrow}>Nullshift / Selected work</p>
          <h1 id="stories-title">
            Client
            <br />
            <em>stories.</em>
          </h1>
          <div className={styles.coverFooter}>
            <p>
              Different businesses.
              <br />
              Software built around each one.
            </p>
            <a href="#suffolk-tennis">
              <span>01 / Suffolk Tennis</span>
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>
        <article
          id="suffolk-tennis"
          className={styles.story}
          aria-label="Suffolk Tennis case study"
        >
          <ShowcasePrototype embedded />
        </article>
        <section className={styles.next} aria-labelledby="next-stories">
          <p className={styles.eyebrow}>More from Nullshift</p>
          <h2 id="next-stories">The next chapters.</h2>
          <div className={styles.placeholders}>
            <article id="the-dance-exclusive">
              <span className={styles.eyebrow}>02 / Coming soon</span>
              <h3>The Dance Exclusive</h3>
              <p>A closer look at the system behind the studio.</p>
              <span className={styles.placeholderLabel}>Case study in preparation</span>
            </article>
            <article id="newfuture-therapy">
              <span className={styles.eyebrow}>03 / Coming soon</span>
              <h3>NewFuture Therapy</h3>
              <p>A closer look at software built around a practice.</p>
              <span className={styles.placeholderLabel}>Case study in preparation</span>
            </article>
          </div>
          <div className={styles.cta}>
            <p>Your next chapter starts with a conversation.</p>
            <Link href="/start">Tell us what you have in mind ↗</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
