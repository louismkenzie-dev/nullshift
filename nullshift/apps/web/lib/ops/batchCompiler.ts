import type { IssueRow } from "./issues";
import { KIND_LABEL, SEVERITY_META, SOURCE_LABEL } from "./issues";

/**
 * Fix Pack compiler — turns a set of banked issues plus the system passport
 * into a context-complete Claude Code work order. The output is markdown that
 * can be pasted straight into a Claude Code session, or posted as a GitHub
 * issue with an @claude mention for claude-code-action to pick up.
 */

export type SystemProfileRow = {
  project_id: string;
  repo_full_name: string | null;
  default_branch: string;
  vercel_project: string | null;
  supabase_ref: string | null;
  stack: Record<string, unknown>;
  runbook: string | null;
  quirks: string | null;
};

export function compileBatchPrompt(input: {
  tenantName: string;
  projectName: string;
  liveUrl: string | null;
  profile: SystemProfileRow | null;
  issues: IssueRow[];
  batchTitle: string;
}): string {
  const { profile, issues } = input;
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(`# Fix batch: ${input.tenantName} — ${input.batchTitle}`);
  lines.push("");
  lines.push(
    `You are fixing a batch of ${issues.length} issue${issues.length === 1 ? "" : "s"} on **${input.projectName}**, a production system built and run by NullShift for the client "${input.tenantName}". Work through every issue below, then open a single pull request containing all fixes.`
  );
  lines.push("");

  lines.push(`## System`);
  const facts: string[] = [];
  if (profile?.repo_full_name)
    facts.push(`- Repository: \`${profile.repo_full_name}\` (base branch \`${profile.default_branch}\`)`);
  if (input.liveUrl) facts.push(`- Live URL: ${input.liveUrl}`);
  if (profile?.vercel_project) facts.push(`- Vercel project: \`${profile.vercel_project}\``);
  if (profile?.supabase_ref) facts.push(`- Supabase project ref: \`${profile.supabase_ref}\``);
  if (profile?.stack && Object.keys(profile.stack).length)
    facts.push(`- Stack: ${Object.entries(profile.stack).map(([k, v]) => `${k}: ${String(v)}`).join(", ")}`);
  lines.push(facts.length ? facts.join("\n") : "- (no system passport on file — explore the repo first)");
  lines.push("");

  if (profile?.quirks) {
    lines.push(`## Known footguns`);
    lines.push(profile.quirks.trim());
    lines.push("");
  }
  if (profile?.runbook) {
    lines.push(`## Runbook notes`);
    lines.push(profile.runbook.trim());
    lines.push("");
  }

  lines.push(`## Issues`);
  lines.push("");
  issues.forEach((issue, i) => {
    lines.push(
      `### ${i + 1}. [${KIND_LABEL[issue.kind].toUpperCase()} · ${SEVERITY_META[issue.severity].label.toLowerCase()}] ${issue.title}`
    );
    lines.push("");
    lines.push(
      `Reported via ${SOURCE_LABEL[issue.source].toLowerCase()} on ${issue.created_at.slice(0, 10)}. Issue ID: \`${issue.id}\`.`
    );
    if (issue.description) {
      lines.push("");
      lines.push(issue.description.trim());
    }
    if (issue.repro) {
      lines.push("");
      lines.push(`**Steps to reproduce:**`);
      lines.push(issue.repro.trim());
    }
    if (issue.source_quote) {
      lines.push("");
      lines.push(`**Original report (verbatim):**`);
      lines.push(
        issue.source_quote
          .trim()
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n")
      );
    }
    lines.push("");
    lines.push(
      `**Done when:** the ${issue.kind === "bug" ? "behaviour described above no longer occurs and the surrounding flow still works" : "requested change works end-to-end in the real flow"}.`
    );
    lines.push("");
  });

  lines.push(`## Working rules`);
  lines.push(
    [
      `- Branch from \`${profile?.default_branch ?? "main"}\` onto \`fix/${date}-batch\`; one PR for the whole batch.`,
      `- Fix root causes, not symptoms. Keep changes minimal — no drive-by refactors.`,
      `- Run the project's typecheck/build (and tests where they exist) before opening the PR.`,
      `- Never commit secrets. Database changes go through migration files, not ad-hoc SQL.`,
      `- In the PR description, list each issue by number with a one-line plain-English summary of the fix, written for a non-technical client ("Fixed: parents couldn't rebook at the Leeds venue"). These lines feed the client's update feed verbatim.`,
      `- If an issue can't be fixed (needs a decision, missing access, out of scope), say so explicitly in the PR description under a "Not fixed" heading with the reason — don't fix it halfway.`,
    ].join("\n")
  );
  lines.push("");

  return lines.join("\n");
}
