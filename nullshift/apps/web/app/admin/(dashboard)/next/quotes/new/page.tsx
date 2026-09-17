import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { loadOperations } from "@/lib/next/live-data";
import { quoteBuilderEnabled } from "@/lib/next/quote-data";
import { emptyQuote } from "@/lib/next/quote-builder";
import { QuoteBuilder } from "../QuoteBuilder";
export default async function NewQuote({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  if (!quoteBuilderEnabled()) notFound();
  const [data, search] = await Promise.all([loadOperations(), searchParams]);
  const client = data.clients.find((c) => c.id === search.client);
  const initial = emptyQuote();
  if (client)
    Object.assign(initial.document, {
      clientId: client.id,
      business: client.name,
      email: client.contact_email || "",
    });
  return (
    <QuoteBuilder
      id={randomUUID()}
      initial={initial}
      clients={data.clients.map((c) => ({
        id: c.id,
        name: c.name,
        contact_email: c.contact_email,
      }))}
    />
  );
}
