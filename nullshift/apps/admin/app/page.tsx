import { redirect } from "next/navigation";

/** The admin app lives under /admin/*; bounce the root to the dashboard. */
export default function AdminRoot() {
  redirect("/admin");
}
