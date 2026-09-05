import type { IssueRow } from "./issues";

/**
 * Outcome review — what a Claude Code session actually did for each issue,
 * drafted from its pull request, reviewed by a person, and only then shown
 * to the client.
 *
 * The work order asks the session to end its PR description with a machine
 * readable block:
 *
 *   ## Outcomes
 *   - <issue-id> | fixed | The Leeds rebooking page works again.
 *   - <issue-id> | answered | The cake marks a birthday this week.
 *   - <issue-id> | not_done | Needs a decision on which prices to show.
 *
 * Older batches (and any session that ignores the format) fall back to a
 * loose scan: a line mentioning an issue id, or a numbered "### N." heading
 * matching the order the issues were compiled in. Anything unparsed simply
 * arrives blank for a human to write — never silently wrong.
 */

export type OutcomeKind = "fixed" | "answered" | "not_done";

export type OutcomeDraft = {
  issueId: string;
  outcome: OutcomeKind;
  note: string;
};

export const OUTCOME_LABEL: Record<OutcomeKind, string> = {
  fixed: "Fixed",
  answered: "Answered",
  not_done: "Not done",
};

export const OUTCOME_TONE: Record<OutcomeKind, "success" | "accent" | "warning"> = {
  fixed: "success",
  answered: "accent",
  not_done: "warning",
};

/** What the client's update feed calls it. `not_done` never reaches them. */
export const clientTitle = (outcome: OutcomeKind, issueTitle: string): string =>
  `${OUTCOME_LABEL[outcome]}: ${issueTitle}`;

/** A question is answered, not fixed — the default when nothing says otherwise. */
export const defaultOutcome = (kind: IssueRow["kind"]): OutcomeKind =>
  kind === "question" || kind === "decision" ? "answered" : "fixed";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const KIND_WORDS: { re: RegExp; kind: OutcomeKind }[] = [
  { re: /^(not[ _-]?done|not[ _-]?fixed|blocked|skipped)\b/i, kind: "not_done" },
  { re: /^(answered|answer)\b/i, kind: "answered" },
  { re: /^(fixed|done|built|shipped|added)\b/i, kind: "fixed" },
];

const readKind = (s: string): OutcomeKind | null =>
  KIND_WORDS.find((k) => k.re.test(s.trim()))?.kind ?? null;

/** Strip markdown bullets, bold and trailing punctuation from a note. */
const tidy = (s: string): string =>
  s
    .replace(/^[-*+\s]+/, "")
    .replace(/\*\*/g, "")
    .replace(/^[:—–-]\s*/, "")
    .trim();

/**
 * Read a PR description into one draft per issue. Issues the PR never
 * mentions come back with an empty note and their kind's default outcome, so
 * the review list is always the whole batch.
 */
export function parseOutcomes(body: string, issues: IssueRow[]): OutcomeDraft[] {
  const byId = new Map<string, { outcome: OutcomeKind; note: string }>();
  const lines = (body ?? "").split(/\r?\n/);

  // Pass 1 — the structured block, and any line carrying an issue id.
  for (const line of lines) {
    const id = line.match(UUID)?.[0]?.toLowerCase();
    if (!id) continue;
    // Everything after the id, split on the pipes the structured form uses.
    // Tidy first: a part that was only markdown ("**") must not be read as
    // the outcome word and must not survive into the note.
    const parts = line
      .slice(line.toLowerCase().indexOf(id) + id.length)
      .split("|")
      .map(tidy)
      .filter(Boolean);
    const kind = parts.length ? readKind(parts[0]) : null;
    const note = tidy((kind ? parts.slice(1) : parts).join(" — "));
    if (!note && !kind) continue;
    byId.set(id, { outcome: kind ?? "fixed", note });
  }

  // Pass 2 — loose prose: "Fixed: <title>" / "Answered: <title>" lines, matched
  // to an issue by its title. Only fills gaps pass 1 left.
  for (const line of lines) {
    const kind = readKind(tidy(line));
    if (!kind) continue;
    const text = tidy(line).replace(KIND_WORDS.find((k) => k.kind === kind)!.re, "");
    const note = tidy(text);
    if (!note) continue;
    const hit = issues.find(
      (i) =>
        !byId.has(i.id) &&
        note
          .toLowerCase()
          .includes(i.title.toLowerCase().slice(0, Math.min(24, i.title.length)))
    );
    if (hit) byId.set(hit.id, { outcome: kind, note });
  }

  return issues.map((i) => {
    const found = byId.get(i.id.toLowerCase());
    return {
      issueId: i.id,
      outcome: found?.outcome ?? defaultOutcome(i.kind),
      note: found?.note ?? "",
    };
  });
}

/** Ready to publish: approved, not already published, and actually says something. */
export const isPublishable = (o: {
  outcome: string;
  note: string;
  approved_at: string | null;
  published_at: string | null;
}): boolean =>
  !!o.approved_at &&
  !o.published_at &&
  o.outcome !== "not_done" &&
  o.note.trim().length > 0;
