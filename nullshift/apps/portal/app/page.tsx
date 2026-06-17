import { redirect } from "next/navigation";

/** The portal lives under /portal/*; bounce the root to the client dashboard. */
export default function PortalRoot() {
  redirect("/portal");
}
