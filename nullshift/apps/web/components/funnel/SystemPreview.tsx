import { T } from "@nullshift/ui/tokens";
import type { BlueprintModule } from "@nullshift/content/blueprint";

/**
 * SystemPreview — a personalised, literal mock of the prospect's *own* software,
 * composed deterministically from the modules their Build Blueprint selected and
 * branded with their business name. No human input, no bespoke artwork: a browser-
 * framed app shell (their nav = their modules), a week calendar, and stat tiles
 * that switch on which modules are included. Pure/presentational so it renders in
 * both the funnel result (client) and the /plan/[token] page (server).
 */

const NAV_LABEL: Record<string, string> = {
  site: "Website",
  booking: "Calendar",
  records: "Records",
  reminders: "Reminders",
  payments: "Payments",
  portal: "Portal",
  forms: "Forms",
  recall: "Recall",
  migration: "Data",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

type Appt = { day: number; time: string; label: string };
const APPTS_CLINIC: Appt[] = [
  { day: 0, time: "09:00", label: "New patient" },
  { day: 0, time: "14:30", label: "Follow-up" },
  { day: 1, time: "11:00", label: "Assessment" },
  { day: 2, time: "10:15", label: "Review" },
  { day: 2, time: "16:00", label: "Follow-up" },
  { day: 4, time: "09:30", label: "New patient" },
];
const APPTS_GENERIC: Appt[] = [
  { day: 0, time: "09:00", label: "New client" },
  { day: 1, time: "11:00", label: "Consult" },
  { day: 1, time: "15:30", label: "Booking" },
  { day: 3, time: "10:00", label: "Review" },
  { day: 4, time: "13:00", label: "Consult" },
];

function initials(label: string): string {
  const words = label
    .replace(/^your\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "N";
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

export function SystemPreview({
  businessLabel,
  modules,
  isClinic,
}: {
  businessLabel: string;
  modules: BlueprintModule[];
  isClinic: boolean;
}) {
  const assets = new Set(modules.map((m) => m.asset));
  // Nav = a stable order of the modules they're getting (Calendar always shown).
  const navOrder = [
    "booking",
    "records",
    "portal",
    "payments",
    "reminders",
    "forms",
    "recall",
    "site",
  ];
  const nav = navOrder.filter((a) => assets.has(a)).map((a) => NAV_LABEL[a]);

  const appts = isClinic ? APPTS_CLINIC : APPTS_GENERIC;
  const noun = isClinic ? "patients" : "clients";

  const stats: { value: string; label: string }[] = [];
  if (assets.has("booking"))
    stats.push({ value: String(appts.length), label: "Booked this week" });
  if (assets.has("payments")) stats.push({ value: "£420", label: "Deposits today" });
  if (assets.has("reminders")) stats.push({ value: "12", label: "Reminders sent" });
  if (assets.has("records") && stats.length < 3)
    stats.push({ value: "1,240", label: `${noun} on file` });
  if (!stats.length) stats.push({ value: "100%", label: "Yours to own" });

  const host =
    businessLabel
      .replace(/^your\s+/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "") || "yourclinic";

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.lg,
        overflow: "hidden",
        boxShadow: T.shadow.md,
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2"
        style={{
          height: 38,
          padding: "0 14px",
          borderBottom: `1px solid ${T.border}`,
          background: T.bg,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 999, background: "#2f323d" }} />
        <span style={{ width: 9, height: 9, borderRadius: 999, background: "#2f323d" }} />
        <span style={{ width: 9, height: 9, borderRadius: 999, background: "#2f323d" }} />
        <div
          className="flex items-center gap-2 mx-auto"
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            color: T.muted,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 999,
            padding: "3px 12px",
          }}
        >
          <span
            style={{ width: 6, height: 6, borderRadius: 999, background: T.primary }}
          />
          app.{host}.co.uk
        </div>
      </div>

      {/* App shell */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)" }}>
        <div className="ns-preview-shell">
          {/* Sidebar */}
          <aside
            className="ns-preview-rail"
            style={{
              borderRight: `1px solid ${T.border}`,
              background: T.bg,
              padding: "16px 14px",
            }}
          >
            <div className="flex items-center gap-2.5" style={{ marginBottom: 18 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: T.primary,
                  color: T.primaryFg,
                  fontFamily: T.display,
                  fontWeight: 700,
                  fontSize: 13,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {initials(businessLabel)}
              </span>
              <span
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: 13,
                  color: T.fg,
                  lineHeight: 1.15,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {businessLabel}
              </span>
            </div>
            <nav className="flex flex-col gap-1">
              {nav.map((label, i) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5"
                  style={{
                    padding: "7px 10px",
                    borderRadius: 7,
                    background: i === 0 ? `${T.primary}1a` : "transparent",
                    fontFamily: T.sans,
                    fontSize: 12.5,
                    fontWeight: i === 0 ? 600 : 500,
                    color: i === 0 ? T.primary : T.muted,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: i === 0 ? T.primary : T.borderStr,
                    }}
                  />
                  {label}
                </div>
              ))}
            </nav>
          </aside>

          {/* Main */}
          <div style={{ padding: "18px 18px 20px", minWidth: 0 }}>
            {/* Stat tiles */}
            <div className="flex flex-wrap gap-2.5" style={{ marginBottom: 16 }}>
              {stats.slice(0, 3).map((s) => (
                <div
                  key={s.label}
                  style={{
                    flex: "1 1 96px",
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.r.md,
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: T.display,
                      fontWeight: 700,
                      fontSize: 18,
                      letterSpacing: "-0.02em",
                      color: T.fg,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontFamily: T.sans,
                      fontSize: 11,
                      color: T.muted,
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Week calendar */}
            <div
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.md,
                padding: 12,
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: 10 }}
              >
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 600,
                    fontSize: 12.5,
                    color: T.fg,
                  }}
                >
                  This week
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.faint }}>
                  {isClinic ? "Multi-practitioner" : "Bookings"}
                </span>
              </div>
              <div
                style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}
              >
                {DAYS.map((d, di) => (
                  <div key={d} className="flex flex-col gap-1.5" style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: 9.5,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: T.faint,
                        textAlign: "center",
                        paddingBottom: 2,
                      }}
                    >
                      {d}
                    </div>
                    {appts
                      .filter((a) => a.day === di)
                      .map((a, ai) => (
                        <div
                          key={ai}
                          style={{
                            background: `${T.primary}14`,
                            border: `1px solid ${T.primary}3a`,
                            borderRadius: 6,
                            padding: "5px 6px",
                          }}
                        >
                          <div
                            style={{ fontFamily: T.mono, fontSize: 9, color: T.primary }}
                          >
                            {a.time}
                          </div>
                          <div
                            style={{
                              fontFamily: T.sans,
                              fontSize: 9.5,
                              color: T.fg,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {a.label}
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
