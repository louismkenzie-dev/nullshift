import { redirect } from "next/navigation";

// The marketing site is now focused on allied-health clinics; the homepage is
// the clinic pitch, so the old vertical landing pages redirect to it.
export default function Page() {
  redirect("/");
}
