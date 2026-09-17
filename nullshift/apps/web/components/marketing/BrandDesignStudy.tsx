"use client";

import { useState } from "react";
import styles from "./DesignTalent.module.css";

const DIRECTIONS = {
  evolve: {
    label: "Brand evolution",
    brand: "FORME",
    descriptor: "Movement, made personal.",
    headline: "A little space. Just for you.",
    note: "An established identity, translated into a calm, cohesive digital experience.",
  },
  rebrand: {
    label: "Full rebrand",
    brand: "OFF/GRID",
    descriptor: "Move on your own terms.",
    headline: "Less routine. More movement.",
    note: "A new name, visual language and tone of voice—carried through every screen.",
  },
} as const;

type Direction = keyof typeof DIRECTIONS;

const SESSIONS = [
  { time: "09:00", name: "Morning flow", coach: "Alex", spaces: "8 / 12" },
  { time: "12:30", name: "Strength & balance", coach: "Jamie", spaces: "10 / 12" },
  { time: "17:00", name: "Evening reset", coach: "Morgan", spaces: "6 / 12" },
];

export function BrandDesignStudy() {
  const [direction, setDirection] = useState<Direction>("evolve");
  const design = DIRECTIONS[direction];

  return (
    <div className={styles.study}>
      <div className={styles.studyToolbar}>
        <span className={styles.label}>One studio. Two creative directions.</span>
        <div
          className={styles.switcher}
          role="group"
          aria-label="Choose a design direction"
        >
          {(Object.keys(DIRECTIONS) as Direction[]).map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={direction === key}
              aria-controls="brand-design-preview"
              onClick={() => setDirection(key)}
            >
              {DIRECTIONS[key].label}
            </button>
          ))}
        </div>
      </div>

      <div id="brand-design-preview" className={styles.canvas} data-direction={direction}>
        <div className={styles.identity} aria-hidden="true">
          <span className={styles.wordmark}>{design.brand}</span>
          <span className={styles.identityDescriptor}>{design.descriptor}</span>
          <div className={styles.swatches}>
            <i />
            <i />
            <i />
          </div>
        </div>

        <div
          className={styles.screens}
          role="img"
          aria-label={`${design.brand} design concept: a team schedule paired with a customer booking experience in the same identity. All names and data are fictional.`}
        >
          <div className={styles.teamScreen} aria-hidden="true">
            <div className={styles.screenBar}>
              <span>{design.brand} / STUDIO</span>
              <span>
                TEAM WORKSPACE <b>AL</b>
              </span>
            </div>
            <div className={styles.dashboard}>
              <div className={styles.sidebar}>
                <span className={styles.navActive}>Overview</span>
                <span>Schedule</span>
                <span>Members</span>
                <span>Messages</span>
                <span className={styles.sidebarBottom}>
                  Your studio.
                  <br />
                  In good form.
                </span>
              </div>
              <div className={styles.workspace}>
                <div className={styles.workspaceHeader}>
                  <div>
                    <span className={styles.micro}>MONDAY / 07 JUNE</span>
                    <p>
                      A good day
                      <br />
                      starts here.
                    </p>
                  </div>
                  <div className={styles.studioGlyph}>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className={styles.metrics}>
                  <div>
                    <strong>03</strong>
                    <span>Sessions today</span>
                  </div>
                  <div>
                    <strong>24</strong>
                    <span>Bookings</span>
                  </div>
                  <div>
                    <strong>78</strong>
                    <span>Members</span>
                  </div>
                </div>
                <div className={styles.scheduleHeading}>
                  <span>Today’s schedule</span>
                  <span>View week ↗</span>
                </div>
                {SESSIONS.map((session) => (
                  <div className={styles.session} key={session.time}>
                    <span>{session.time}</span>
                    <div>
                      <strong>{session.name}</strong>
                      <span>With {session.coach}</span>
                    </div>
                    <span>{session.spaces}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.customerScreen} aria-hidden="true">
            <div className={styles.customerNav}>
              <span>{design.brand}</span>
              <span>MENU ≡</span>
            </div>
            <div className={styles.customerArt}>
              <div className={styles.sculpture}>
                <i />
                <i />
                <i />
              </div>
              <span>ROOM TO MOVE / ROOM TO BE</span>
            </div>
            <div className={styles.customerContent}>
              <p className={styles.customerHeadline}>{design.headline}</p>
              <span className={styles.customerLead}>Find your next feel-good hour.</span>
              <div className={styles.booking}>
                <span>MON, 07 JUN · 09:00</span>
                <strong>Morning flow</strong>
                <span>50 minutes · All levels</span>
              </div>
              <div className={styles.mockButton}>
                Find your session <span>↗</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.canvasCaption}>
          <span>For your team ↗</span>
          <span>For your customers ↗</span>
        </div>
      </div>

      <div className={styles.studyCaption}>
        <p aria-live="polite" aria-atomic="true">
          {design.note}
        </p>
        <span>Illustrative design study · fictional brands & data</span>
      </div>
    </div>
  );
}
