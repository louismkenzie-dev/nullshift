import { redirect } from "next/navigation";

/** Systems Lab has been superseded by the Agent Consultation (/start): instead
 *  of generic canned demos, the agent builds a live mockup of the visitor's own
 *  system as part of their free plan. The old hand-built demo page lives in git
 *  history if we ever want a gallery back. Permanent redirect keeps old links
 *  and indexed URLs working. */
export default function SystemsLabRedirect() {
  redirect("/start");
}
