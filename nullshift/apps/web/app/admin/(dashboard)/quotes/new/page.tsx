import Link from "next/link";
import { createServiceClient } from "@nullshift/db";
import { loadQuoteVersionContext } from "@/lib/commercial/quotes";
import { isUuid } from "@/lib/commercial/repo";
import { isContentEditable } from "@/lib/commercial/stateMachine";
import { parseGuidedInput, type GuidedInput } from "@/lib/estimator/guided";
import s from "../../shell.module.css";
import { first } from "../../sales/ops-ui";
import { GuidedQuoteForm, type ClientOption, type ExistingDraft } from "./GuidedQuoteForm";

export const dynamic = "force-dynamic";

/**
 * /admin/quotes/new — the guided estimator, the default way to start a quote.
 * Plug in who, how big and what they want; the build and monthly recompute
 * live from the same engines the Studio uses. `?quote=<versionId>` preloads
 * the inputs a draft was created from ("Adjust inputs" in the Studio).
 */

async function clientOptions(): Promise<ClientOption[]> {
  const { data } = await createServiceClient()
    .from("tenants")
    .select("id, name")
    .eq("type", "client")
    .order("name")
    .limit(200);
  return (data ?? []) as ClientOption[];
}

async function existingDraft(
  quoteId: string | undefined
): Promise<{ initial: GuidedInput | null; existing: ExistingDraft | null }> {
  if (!quoteId || !isUuid(quoteId)) return { initial: null, existing: null };
  const ctx = await loadQuoteVersionContext(quoteId);
  if (!ctx) return { initial: null, existing: null };
  const parsed = parseGuidedInput(ctx.version.internal.guided_input ?? null);
  return {
    initial: parsed.ok ? parsed.value : null,
    existing: {
      versionId: ctx.version.id,
      expectedUpdatedAt: ctx.version.updated_at,
      editable: isContentEditable(ctx.version.status),
      label: `${ctx.opportunity.trading_name || ctx.opportunity.legal_name} v${ctx.version.version_no}`,
    },
  };
}

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const [clients, draft] = await Promise.all([clientOptions(), existingDraft(first(sp.quote))]);

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/quotes">Sales &amp; Quotes</Link> / New quote
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>{draft.existing ? "Adjust the estimate" : "New quote"}</h1>
          <p className={s.lead}>
            Plug in who the client is, how big they are and what they want. The build price and the
            monthly update as you go. Save when it looks right; the Studio opens with the packages and
            prices filled in, ready for review.
          </p>
        </div>
        <Link href="/admin/quotes" className={s.btn}>
          All quotes
        </Link>
      </div>
      {draft.existing && !draft.initial ? (
        <p className={s.banner}>
          That draft was not created with the guided estimator, so the form starts blank.
        </p>
      ) : null}
      <GuidedQuoteForm clients={clients} initial={draft.initial} existing={draft.existing} />
    </>
  );
}
