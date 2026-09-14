/** Fictional, deterministic fixtures. Never import database or payment clients here. */
export type DemoView = "booking" | "scanner" | "register";
export type DemoPerson = { id: string; name: string; paid: boolean; present: boolean };
export type DemoState = { people: DemoPerson[]; booked: boolean; notice: string };
export type DemoAction =
  | { type: "book" }
  | { type: "scan"; id: string }
  | { type: "attendance"; id: string }
  | { type: "reset" };
export const DEMO_TICKET = "DEMO-104";
export function initialDemoState(): DemoState {
  return {
    booked: false,
    notice: "",
    people: [
      { id: "DEMO-101", name: "Alex Morgan", paid: true, present: false },
      { id: "DEMO-102", name: "Jamie Ellis", paid: true, present: false },
      { id: "DEMO-103", name: "Robin Hayes", paid: false, present: false },
    ],
  };
}
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  if (action.type === "reset") return initialDemoState();
  if (action.type === "book") {
    if (state.booked) return state;
    return {
      booked: true,
      notice: "Booking confirmed. Your demo ticket is ready.",
      people: [
        ...state.people,
        { id: DEMO_TICKET, name: "Sam Taylor", paid: true, present: false },
      ],
    };
  }
  const person = state.people.find((p) => p.id === action.id.trim().toUpperCase());
  if (!person) return { ...state, notice: "Ticket not found. No admission recorded." };
  if (!person.paid)
    return { ...state, notice: "Payment outstanding. No admission recorded." };
  if (action.type === "scan" && person.present)
    return {
      ...state,
      notice: `Already checked in — ${person.name}. Duplicate scan stopped.`,
    };
  return {
    ...state,
    people: state.people.map((p) =>
      p.id === person.id ? { ...p, present: !p.present } : p
    ),
    notice: person.present
      ? `${person.name} marked not arrived.`
      : `Checked in — ${person.name}. Register updated.`,
  };
}
