import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { listBuilderQuotes } from "@/lib/next/quote-data";
import { gbp } from "@/lib/next/quote-builder";
import s from "../next.module.css";
export async function LiveQuotes({ compact = false }: { compact?: boolean }) {
  const quotes = await listBuilderQuotes();
  return (
    <section className={s.workPanel}>
      <div className={s.panelHead}>
        <div>
          <p className={s.eyebrow}>Scope → price → proposal</p>
          {compact ? <h2 className={s.h2}>Quotes</h2> : <h1 className={s.h1}>Quotes</h1>}
          <p className={s.muted}>
            Save a draft, reopen it and prepare a client-facing PDF.
          </p>
        </div>
        <Link href="/admin/next/quotes/new" className={s.btnPrimary}>
          <Plus size={16} />
          Build a quote
        </Link>
      </div>
      {quotes.map((quote) => (
        <Link
          key={quote.id}
          href={`/admin/next/quotes/${quote.id}`}
          className={s.actionRow}
        >
          <span className={s.actionBody}>
            <strong>{quote.title}</strong>
            <span>
              {quote.business} · v{quote.version} · {quote.status.replaceAll("_", " ")}
            </span>
          </span>
          <strong>{gbp(quote.buildMinor)}</strong>
          <ArrowRight size={16} />
        </Link>
      ))}
      {!quotes.length && (
        <div className={s.panelBody}>
          <h2 className={s.h2}>Your first quote starts here</h2>
          <p className={s.muted}>
            Choose a client or prospect, define the scope and add your prices. Existing
            proposals and agreements stay unchanged.
          </p>
        </div>
      )}
      <div className={s.panelFoot}>
        Most recent 100 quote versions. Saving and printing do not send emails, accept
        agreements or activate billing.
      </div>
    </section>
  );
}
