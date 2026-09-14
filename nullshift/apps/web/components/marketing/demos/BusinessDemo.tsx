"use client";

import Link from "next/link";
import { useReducer, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ScanLine,
  CalendarDays,
  Users,
  RotateCcw,
} from "lucide-react";
import {
  DEMO_TICKET,
  demoReducer,
  initialDemoState,
  type DemoView,
} from "@/lib/businessDemo";
import styles from "./BusinessDemo.module.css";

export function BusinessDemo() {
  const [state, dispatch] = useReducer(demoReducer, undefined, initialDemoState);
  const [view, setView] = useState<DemoView>("booking");
  const [ticket, setTicket] = useState(DEMO_TICKET);
  const present = state.people.filter((p) => p.present).length;
  const reset = () => {
    dispatch({ type: "reset" });
    setView("booking");
    setTicket(DEMO_TICKET);
  };
  return (
    <main className={`k-dark ${styles.demo}`}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          nullshift<span> / playground</span>
        </Link>
        <button onClick={reset} className={styles.reset}>
          <RotateCcw size={14} /> Reset demo
        </button>
      </header>
      <div className={styles.disclaimer}>
        FICTIONAL DEMO · No real payments. No client data. Resets when you leave.
      </div>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>ONE EXAMPLE. THREE CONNECTED MOMENTS.</p>
        <h1>
          From booked
          <br />
          to <span>checked in.</span>
        </h1>
        <p>
          Try it yourself. Book a space, scan the ticket, then watch the register update.
        </p>
      </section>
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.studio}>
            <span className={styles.studioMark}>E</span>
            <div>
              Example Studio<small>Fictional business</small>
            </div>
          </div>
          <nav aria-label="Demo views" className={styles.tabs}>
            {(
              [
                ["booking", "01", "Booking", CalendarDays],
                ["scanner", "02", "Ticket scanner", ScanLine],
                ["register", "03", "Attendance", Users],
              ] as const
            ).map(([id, number, label, Icon]) => (
              <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>
                <Icon size={18} />
                <span>{label}</span>
                <small>{number}</small>
              </button>
            ))}
          </nav>
          <div className={styles.connection}>
            <span /> One connected system<small>Updates stay in this browser tab.</small>
          </div>
        </aside>
        <section className={styles.screen} aria-label="Interactive demo">
          <div className={styles.screenHeader}>
            <span>{view === "booking" ? "CUSTOMER VIEW" : "TEAM VIEW"}</span>
            <span className={styles.live}>● Demo mode</span>
          </div>
          {view === "booking" && (
            <div className={styles.booking}>
              <div className={styles.classArt} aria-hidden>
                <span>
                  MOVE
                  <br />
                  TOGETHER.
                </span>
                <i />
                <b>EXAMPLE STUDIO / ADULTS</b>
              </div>
              <div className={styles.classInfo}>
                <p className={styles.eyebrow}>SATURDAY SESSION · FICTIONAL EVENT</p>
                <h2>Weekend movement</h2>
                <p>
                  A feel-good movement class for adults. All experience levels welcome.
                </p>
                <dl>
                  <div>
                    <dt>When</dt>
                    <dd>Saturday · 10:00–11:00</dd>
                  </div>
                  <div>
                    <dt>Where</dt>
                    <dd>Example Studio, Room One</dd>
                  </div>
                  <div>
                    <dt>Demo attendee</dt>
                    <dd>Sam Taylor</dd>
                  </div>
                </dl>
                {!state.booked ? (
                  <>
                    <button
                      className={styles.primary}
                      onClick={() => dispatch({ type: "book" })}
                    >
                      Simulate booking & payment <ArrowUpRight size={18} />
                    </button>
                    <small className={styles.note}>
                      No card details, charge, email or real booking.
                    </small>
                  </>
                ) : (
                  <div className={styles.confirmation}>
                    <Check size={24} />
                    <h3>You’re on the list.</h3>
                    <p>Sam Taylor · Payment simulated</p>
                    <code>{DEMO_TICKET}</code>
                    <button className={styles.primary} onClick={() => setView("scanner")}>
                      Try the ticket scanner <ArrowUpRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {view === "scanner" && (
            <div className={styles.scanner}>
              <div>
                <p className={styles.eyebrow}>SATURDAY · ROOM ONE</p>
                <h2>Welcome them in.</h2>
                <p>
                  Simulate reading a demo ticket. Valid tickets update attendance
                  instantly.
                </p>
                <div className={styles.scanWindow} aria-hidden>
                  <ScanLine size={92} strokeWidth={1} />
                  <span>SIMULATED SCANNER · NO CAMERA</span>
                </div>
              </div>
              <div className={styles.scanControls}>
                <label htmlFor="demo-ticket">Demo ticket</label>
                <select
                  id="demo-ticket"
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                >
                  <option value={DEMO_TICKET}>
                    Sam Taylor — {state.booked ? "paid" : "book first"}
                  </option>
                  <option value="DEMO-101">Alex Morgan — paid</option>
                  <option value="DEMO-102">Jamie Ellis — paid</option>
                  <option value="DEMO-103">Robin Hayes — unpaid</option>
                  <option value="DEMO-999">Unknown ticket — test rejection</option>
                </select>
                <button
                  className={styles.primary}
                  onClick={() => dispatch({ type: "scan", id: ticket })}
                >
                  Simulate scan <ScanLine size={18} />
                </button>
                <p>
                  Try the same ticket twice, or select an unpaid ticket to see the
                  safeguards.
                </p>
                <button className={styles.secondary} onClick={() => setView("register")}>
                  View attendance <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          )}
          {view === "register" && (
            <div className={styles.register}>
              <div className={styles.registerHeading}>
                <div>
                  <p className={styles.eyebrow}>WEEKEND MOVEMENT</p>
                  <h2>Everyone, accounted for.</h2>
                </div>
                <div className={styles.count}>
                  {present}
                  <span>
                    {" "}
                    / {state.people.length}
                    <small>checked in</small>
                  </span>
                </div>
              </div>
              <p>
                Scans appear here immediately. You can also mark paid attendees manually.
              </p>
              <ul className={styles.people}>
                {state.people.map((person) => (
                  <li key={person.id}>
                    <span className={styles.avatar}>
                      {person.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <div>
                      <strong>{person.name}</strong>
                      <small>
                        {person.id} ·{" "}
                        {person.paid ? "Payment simulated" : "Payment outstanding"}
                      </small>
                    </div>
                    <button
                      disabled={!person.paid}
                      aria-label={`${person.present ? "Mark not arrived" : "Mark present"}: ${person.name}`}
                      aria-pressed={person.present}
                      onClick={() => dispatch({ type: "attendance", id: person.id })}
                    >
                      {person.present ? (
                        <>
                          <Check size={15} /> Present
                        </>
                      ) : person.paid ? (
                        "Mark present"
                      ) : (
                        "Unpaid"
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className={styles.notice} role="status" aria-live="polite">
            {state.notice || "All names, events and tickets in this demo are fictional."}
          </p>
        </section>
      </div>
      <footer className={styles.footer}>
        <p>This is an illustrative Nullshift system, not a client’s live application.</p>
        <Link href="/start">What would yours look like? ↗</Link>
      </footer>
    </main>
  );
}
