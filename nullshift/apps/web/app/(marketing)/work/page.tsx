import { redirect } from "next/navigation";

/** /work is superseded by /client-stories — the NewFuture Therapy build story
 *  with Laura's testimonial in the Nullshift-branded Mux player (the old page
 *  embedded it via a Google Drive iframe). Redirect keeps indexed links live. */
export default function WorkRedirect() {
  redirect("/client-stories");
}
