"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@nullshift/ui/tokens";
import Link from "next/link";

const faqs = [
  {
    category: "Data & Compliance",
    q: "Is patient data safe and GDPR-compliant?",
    a: "Yes. We act as your data processor under a signed DPA, host your system in the UK/EU, and encrypt data in transit and at rest with a full audit trail. Notes, intake forms and patient history live in a system you own — GDPR-compliant, exportable any time, and never sold or locked in. You stay the data controller; we just run the infrastructure on your behalf.",
  },
  {
    category: "Data & Compliance",
    q: "What does the DPA actually cover?",
    a: "The Data Processing Agreement sets out, in writing, that your clinic is the data controller and Nullshift is the processor — we only process patient data on your documented instructions, keep it in the UK/EU, apply the security measures above, and return or delete it if you ever leave. It's signed before any patient data touches the system, so your compliance paperwork is covered from day one.",
  },
  {
    category: "Migrating Over",
    q: "What about my existing booking system and records?",
    a: "We migrate them for you. You keep running your current tools as normal until the new system is live and fully tested — there's no gap where you can't take bookings. Then we move your calendars, patient records and history across, you confirm everything looks right, and only then do you cancel the old subscriptions you no longer need.",
  },
  {
    category: "Migrating Over",
    q: "How long does it take to go live?",
    a: "Most clinics are live in a matter of weeks, not months, once we've had the 15-minute call and you've signed off the design direction. We build, you test it against your real workflow, your data is migrated, and we switch over. You'll get a clear timeline in your proposal before anything starts.",
  },
  {
    category: "Ownership & Care Plan",
    q: "Do I actually own the system?",
    a: "Yes — completely. You own the code, the patient data and every account it runs on (your domain, your Stripe, your database). You can cancel the care plan at any time and keep everything, with a full export of your records and the running system handed over. There's no hostage situation and no lock-in.",
  },
  {
    category: "Ownership & Care Plan",
    q: "Why pay a monthly care plan if I own it?",
    a: "Because owning the asset and running it are two different things. The build fee (from £2,950) buys you the system outright. The care plan (from £49/mo) is hosting, daily backups, security updates and us keeping it running — typically a fraction of the per-practitioner SaaS stack it replaces, with no rebilled-tool markups. Cancel whenever you like and you keep the code and data; you'd just take over hosting and maintenance yourself.",
  },
  {
    category: "Ownership & Care Plan",
    q: "We're a small or solo clinic — is this overkill?",
    a: "No — it scales down cleanly. A solo or two-practitioner clinic owns a tidy booking-and-payments system for less than it would rent three or four separate SaaS tools each month. Because the rented tools charge per practitioner, the savings only get bigger as you add team members — but the model already works in your favour at one chair.",
  },
  {
    category: "Payments",
    q: "How do patient payments work?",
    a: "Patients pay through your own Stripe account, so you keep the merchant relationship and the money lands directly with you. Instead of the 2–3% an incumbent booking tool skims on top, you pay a small flat platform fee. Deposits and prepayment for appointments are built into the booking flow, not bolted on as another monthly add-on.",
  },
  {
    category: "Payments",
    q: "What does the system include for the build fee?",
    a: "Online booking with deposits and automatic SMS + email reminders to cut no-shows, patient records, notes and intake forms, multi-practitioner calendars, and patient payments through your own Stripe — all in one system you own outright. Higher tiers add waitlist auto-fill, a patient portal, document e-sign and custom integrations. It replaces the stack of subscriptions you're currently renting.",
  },
];

function AccordionItem({ item, index }: { item: (typeof faqs)[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={index * 0.04}>
      <div style={{ borderBottom: `1px solid ${T.border}` }}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-start justify-between gap-6 text-left py-6 px-10 md:px-16"
          style={{
            background: "transparent",
            cursor: "pointer",
            transition: `background ${T.duration.base} ${T.ease}`,
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background = T.surface)
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "transparent")
          }
        >
          <div className="flex flex-col gap-1.5">
            <span
              style={{
                fontFamily: T.sans,
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.primary,
              }}
            >
              {item.category}
            </span>
            <span
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: "clamp(1rem, 1.8vw, 1.2rem)",
                letterSpacing: "-0.015em",
                lineHeight: 1.3,
                color: T.fg,
              }}
            >
              {item.q}
            </span>
          </div>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "1.2rem",
              color: open ? T.primary : T.muted,
              flexShrink: 0,
              marginTop: "14px",
              transition: `transform ${T.duration.base}, color ${T.duration.base}`,
              transform: open ? "rotate(45deg)" : "rotate(0deg)",
              display: "inline-block",
            }}
          >
            +
          </span>
        </button>
        {open && (
          <div className="px-10 md:px-16 pb-7">
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.9375rem",
                lineHeight: 1.7,
                letterSpacing: "-0.005em",
                color: T.muted,
                maxWidth: "72ch",
              }}
            >
              {item.a}
            </p>
          </div>
        )}
      </div>
    </Reveal>
  );
}

export default function FaqPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section
          className="pt-28 pb-20 px-8 md:px-16"
          style={{
            backgroundImage: `radial-gradient(ellipse 50% 55% at 65% 35%, ${T.primarySoft} 0%, transparent 70%)`,
          }}
        >
          <div className="mb-7">
            <span
              className="inline-flex items-center gap-2"
              style={{
                fontFamily: T.sans,
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.muted,
              }}
            >
              <span
                className="pulse-dot"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: T.primary,
                  display: "inline-block",
                }}
              />
              Frequently asked
            </span>
          </div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "clamp(3rem, 9vw, 7rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: T.fg,
            }}
          >
            Everything
            <br />
            <span className="hero-glow" style={{ color: T.primary }}>
              you need to know.
            </span>
          </h1>
          <p
            className="mt-6 max-w-[44ch]"
            style={{
              fontFamily: T.sans,
              fontSize: "1rem",
              lineHeight: 1.65,
              letterSpacing: "-0.005em",
              color: T.muted,
            }}
          >
            Can&apos;t find your answer? Book a free 15-minute call and we&apos;ll answer
            everything about your clinic directly.
          </p>
        </section>

        {/* Accordion */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          {faqs.map((item, i) => (
            <AccordionItem key={i} item={item} index={i} />
          ))}
        </section>

        {/* CTA */}
        <section
          className="px-10 md:px-16 py-24 flex flex-col md:flex-row items-start md:items-center justify-between gap-8"
          style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}
        >
          <Reveal>
            <div>
              <h2
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.025em",
                  color: T.fg,
                }}
              >
                Still have <span style={{ color: T.primary }}>questions?</span>
              </h2>
              <p
                className="mt-3"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9375rem",
                  lineHeight: 1.55,
                  letterSpacing: "-0.005em",
                  color: T.muted,
                }}
              >
                Book a free 15-minute call and ask us anything about owning your clinic
                system.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Link
              href="/book"
              className="inline-flex items-center gap-2"
              style={{
                fontFamily: T.sans,
                fontSize: "0.9375rem",
                fontWeight: 500,
                letterSpacing: "-0.005em",
                height: 48,
                paddingInline: 24,
                background: T.primary,
                color: T.primaryFg,
                borderRadius: T.r.md,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
                whiteSpace: "nowrap",
                textDecoration: "none",
                transition: `background ${T.duration.base} ${T.ease}`,
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = T.primaryHover)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = T.primary)
              }
            >
              Book a discovery call →
            </Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
