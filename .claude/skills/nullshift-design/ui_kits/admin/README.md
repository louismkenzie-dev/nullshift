# Admin CRM — UI kit

A recreation of the Nullshift internal `/admin` surface — the studio's own CRM for
running enquiries, clients, calls, quotes and proposals. Same dark system as the
marketing site, but denser and more mono-led (admin labels, reference IDs, system
markers all use JetBrains Mono).

## Screens
- **`AdminTopbar`** — sticky 56px bar: `Nullshift / admin` lockup + hamburger that
  opens a right-hand nav drawer (Dashboard · Users · Enquiries · Clients · Calendar ·
  Quotes · Proposals). The active item carries the emerald left-rule.
- **`Dashboard`** — `// OVERVIEW` header, three `StatCard` KPIs (income, new
  enquiries, missing briefs), two task panels (new enquiries inbox, brief-not-sent),
  an emerald-glow **Next call** card, and a **mini calendar** with call-day dots.
- **`Enquiries`** — a table view of inbound enquiries with status `Badge`s.

## Interaction
Open the drawer and pick **Enquiries** to switch to the table view; any other item
returns to the dashboard. State is local; data is representative, not live.

## Composition
Uses `LogoMark`, `Button`, `Badge`, `StatCard` from the bundle. Panels, rows, the
next-call card and the calendar are kit-local layout built on the tokens.

## Files
- `index.html` — entry; loads React + the DS bundle, mounts the app.
- `nav.jsx` — topbar + drawer navigation.
- `views.jsx` — Dashboard and Enquiries views.
