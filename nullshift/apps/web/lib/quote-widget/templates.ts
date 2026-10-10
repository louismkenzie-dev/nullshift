import type { WidgetConfig } from "./engine";
import { DEFAULT_CONFIG } from "./engine";

/**
 * Starter rate cards. A trade picks one at sign-up and edits the numbers;
 * nobody should face an empty widget. Prices are deliberately middle-of-the-
 * road UK figures and labelled as such in the console.
 */
export type TemplateKey =
  | "plumber"
  | "electrician"
  | "decorator"
  | "landscaper"
  | "cleaner"
  | "blank";

const ACCESS_Q = {
  id: "access",
  label: "How easy is access?",
  type: "choice" as const,
  appliesTo: "all" as const,
  options: [
    { id: "easy", label: "Easy — ground floor, parking nearby", multiplier: 1 },
    { id: "ok", label: "Average", multiplier: 1.08 },
    { id: "hard", label: "Tricky — stairs, no parking, tight space", multiplier: 1.2 },
  ],
};
const URGENCY_Q = {
  id: "urgency",
  label: "When do you need it done?",
  type: "choice" as const,
  appliesTo: "all" as const,
  options: [
    { id: "flex", label: "Whenever suits — I'm flexible", multiplier: 1 },
    { id: "week", label: "Within a week", multiplier: 1.05 },
    { id: "asap", label: "As soon as possible / emergency", multiplier: 1.35 },
  ],
};
const PROPERTY_Q = {
  id: "property",
  label: "What type of property?",
  type: "choice" as const,
  appliesTo: "all" as const,
  options: [
    { id: "flat", label: "Flat", multiplier: 1 },
    { id: "house", label: "House", multiplier: 1.05 },
    { id: "commercial", label: "Commercial premises", multiplier: 1.25 },
  ],
};

export const TEMPLATES: Record<
  TemplateKey,
  { label: string; blurb: string; config: WidgetConfig }
> = {
  plumber: {
    label: "Plumber",
    blurb: "Call-outs, bathroom fits, boiler work and radiators.",
    config: {
      ...DEFAULT_CONFIG,
      trade: "plumber",
      calloutPence: 4500,
      services: [
        {
          id: "leak",
          name: "Fix a leak or dripping tap",
          mode: "hourly",
          pricePence: 6500,
          minHours: 1,
          maxHours: 2,
        },
        { id: "toilet", name: "Replace a toilet", mode: "fixed", pricePence: 22000 },
        {
          id: "radiator",
          name: "Fit or replace radiators",
          mode: "per_unit",
          pricePence: 18000,
          unitLabel: "radiators",
          minQty: 1,
          maxQty: 12,
        },
        {
          id: "bathroom",
          name: "Full bathroom installation",
          mode: "fixed",
          pricePence: 320000,
          description: "Labour only; tiles and fittings supplied by you.",
        },
        { id: "boiler", name: "Boiler service", mode: "fixed", pricePence: 9500 },
        {
          id: "unblock",
          name: "Unblock a drain or sink",
          mode: "hourly",
          pricePence: 7000,
          minHours: 1,
          maxHours: 3,
        },
      ],
      questions: [ACCESS_Q, URGENCY_Q, PROPERTY_Q],
    },
  },
  electrician: {
    label: "Electrician",
    blurb: "Sockets, lighting, consumer units and EICRs.",
    config: {
      ...DEFAULT_CONFIG,
      trade: "electrician",
      calloutPence: 5000,
      services: [
        {
          id: "socket",
          name: "Add or move sockets",
          mode: "per_unit",
          pricePence: 9000,
          unitLabel: "sockets",
          minQty: 1,
          maxQty: 20,
        },
        {
          id: "lights",
          name: "Fit light fittings",
          mode: "per_unit",
          pricePence: 7000,
          unitLabel: "fittings",
          minQty: 1,
          maxQty: 30,
        },
        {
          id: "cu",
          name: "Replace consumer unit (fuse board)",
          mode: "fixed",
          pricePence: 65000,
        },
        { id: "eicr", name: "EICR safety certificate", mode: "fixed", pricePence: 18000 },
        {
          id: "ev",
          name: "EV charger installation",
          mode: "fixed",
          pricePence: 95000,
          description: "Labour and standard cable run; charger supplied separately.",
        },
        {
          id: "fault",
          name: "Fault finding",
          mode: "hourly",
          pricePence: 6500,
          minHours: 1,
          maxHours: 3,
        },
      ],
      questions: [ACCESS_Q, URGENCY_Q, PROPERTY_Q],
    },
  },
  decorator: {
    label: "Painter & decorator",
    blurb: "Rooms, exteriors and woodwork priced by the room or the hour.",
    config: {
      ...DEFAULT_CONFIG,
      trade: "decorator",
      services: [
        {
          id: "room",
          name: "Paint a room (walls and ceiling)",
          mode: "per_unit",
          pricePence: 38000,
          unitLabel: "rooms",
          minQty: 1,
          maxQty: 12,
        },
        {
          id: "woodwork",
          name: "Doors, skirting and woodwork",
          mode: "per_unit",
          pricePence: 9000,
          unitLabel: "rooms",
          minQty: 1,
          maxQty: 12,
        },
        {
          id: "exterior",
          name: "Exterior painting",
          mode: "hourly",
          pricePence: 4500,
          minHours: 8,
          maxHours: 40,
        },
        {
          id: "wallpaper",
          name: "Hang wallpaper",
          mode: "per_unit",
          pricePence: 28000,
          unitLabel: "walls",
          minQty: 1,
          maxQty: 20,
        },
      ],
      questions: [
        {
          id: "condition",
          label: "What condition are the walls in?",
          type: "choice",
          appliesTo: "all",
          options: [
            { id: "good", label: "Good — just needs paint", multiplier: 1 },
            { id: "fair", label: "Some filling and sanding", multiplier: 1.15 },
            { id: "poor", label: "Needs a lot of prep", multiplier: 1.35 },
          ],
        },
        {
          id: "paint",
          label: "Who supplies the paint?",
          type: "yesno",
          appliesTo: "all",
          options: [
            { id: "yes", label: "You supply it", addPence: 6000 },
            { id: "no", label: "I'll buy it", multiplier: 1 },
          ],
        },
        URGENCY_Q,
      ],
    },
  },
  landscaper: {
    label: "Landscaper / gardener",
    blurb: "Lawns, fencing, patios and clearances.",
    config: {
      ...DEFAULT_CONFIG,
      trade: "landscaper",
      services: [
        {
          id: "fence",
          name: "Fencing",
          mode: "per_unit",
          pricePence: 9500,
          unitLabel: "metres",
          minQty: 2,
          maxQty: 200,
        },
        {
          id: "patio",
          name: "Lay a patio",
          mode: "per_unit",
          pricePence: 14000,
          unitLabel: "square metres",
          minQty: 4,
          maxQty: 200,
        },
        {
          id: "turf",
          name: "Lay new turf",
          mode: "per_unit",
          pricePence: 2800,
          unitLabel: "square metres",
          minQty: 10,
          maxQty: 1000,
        },
        {
          id: "clear",
          name: "Garden clearance",
          mode: "hourly",
          pricePence: 4000,
          minHours: 3,
          maxHours: 16,
        },
        {
          id: "maintain",
          name: "Regular maintenance visit",
          mode: "hourly",
          pricePence: 3500,
          minHours: 2,
          maxHours: 4,
        },
      ],
      questions: [
        ACCESS_Q,
        {
          id: "waste",
          label: "Do you need waste taken away?",
          type: "yesno",
          appliesTo: "all",
          options: [
            { id: "yes", label: "Yes", addPence: 12000 },
            { id: "no", label: "No", multiplier: 1 },
          ],
        },
      ],
    },
  },
  cleaner: {
    label: "Cleaner",
    blurb: "Regular, end-of-tenancy and deep cleans.",
    config: {
      ...DEFAULT_CONFIG,
      trade: "cleaner",
      services: [
        {
          id: "regular",
          name: "Regular clean",
          mode: "hourly",
          pricePence: 2200,
          minHours: 2,
          maxHours: 4,
        },
        {
          id: "deep",
          name: "Deep clean",
          mode: "per_unit",
          pricePence: 6500,
          unitLabel: "bedrooms",
          minQty: 1,
          maxQty: 8,
        },
        {
          id: "eot",
          name: "End of tenancy clean",
          mode: "per_unit",
          pricePence: 9000,
          unitLabel: "bedrooms",
          minQty: 1,
          maxQty: 8,
        },
        { id: "oven", name: "Oven clean", mode: "fixed", pricePence: 6500 },
      ],
      questions: [
        {
          id: "carpets",
          label: "Carpets cleaned too?",
          type: "yesno",
          appliesTo: ["deep", "eot"],
          options: [
            { id: "yes", label: "Yes", addPence: 8000 },
            { id: "no", label: "No", multiplier: 1 },
          ],
        },
        URGENCY_Q,
      ],
    },
  },
  blank: {
    label: "Start from scratch",
    blurb: "An empty rate card.",
    config: { ...DEFAULT_CONFIG, services: [], questions: [] },
  },
};

export function templateConfig(key: string, businessName: string): WidgetConfig {
  const t = TEMPLATES[(key in TEMPLATES ? key : "blank") as TemplateKey];
  return { ...t.config, businessName };
}
