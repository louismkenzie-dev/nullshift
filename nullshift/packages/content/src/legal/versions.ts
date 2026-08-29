import { createHash } from "node:crypto";
import { legalConfig } from "./config";

/**
 * Immutable legal document versions (spec §4).
 *
 * An active version is never mutated in place. Revising legal text means
 * adding a new record whose `supersedes` points at the old one, so a client's
 * acceptance can always be resolved back to the exact wording they agreed to.
 *
 * The content hash is computed from the document's canonical source text, so
 * an acceptance record can prove WHICH words were accepted — not merely which
 * version string was current.
 */

export type LegalDocumentType =
  | "MSA"
  | "DPA"
  | "AI"
  | "PAYMENTS"
  | "AUP"
  | "PRIVACY"
  | "COOKIES"
  | "WEBSITE_TERMS"
  | "ORDER_FORM"
  | "CHANGE_ORDER"
  | "ENTERPRISE_SLA"
  | "MANAGED_SERVICES"
  | "PRICING_SCHEDULE"
  | "SECURITY";

export type LegalDocumentVersion = {
  id: string;
  documentType: LegalDocumentType;
  version: string;
  /** ISO date the version takes effect; null while it is a draft. */
  effectiveAt: string | null;
  contentHashSha256: string;
  /** Route that renders the controlling text. */
  renderedHtmlPath: string;
  downloadableArtifactPath?: string;
  supersedes?: string;
  status: "draft" | "active" | "retired";
};

/** Canonical SHA-256 of a document's source text. Whitespace-normalised so
 *  reformatting the source doesn't invalidate an otherwise identical hash. */
export function contentHash(source: string): string {
  const canonical = source
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Build the registry from the live document sources. Called with each
 * document's canonical text so the hash always matches what is actually
 * rendered — a registry of hand-copied hashes would rot immediately.
 */
export function buildRegistry(
  sources: Partial<Record<LegalDocumentType, string>>
): LegalDocumentVersion[] {
  const { publicPolicyVersion, clientAgreementVersion, effectiveDate } =
    legalConfig.legal;
  // Until a solicitor sets the effective date the whole pack is draft, however
  // finished the text looks.
  const status: LegalDocumentVersion["status"] = effectiveDate ? "active" : "draft";

  const spec: [LegalDocumentType, string, string][] = [
    ["WEBSITE_TERMS", publicPolicyVersion, legalConfig.routes.websiteTerms],
    ["PRIVACY", publicPolicyVersion, legalConfig.routes.privacy],
    ["COOKIES", publicPolicyVersion, legalConfig.routes.cookies],
    ["AUP", clientAgreementVersion, legalConfig.routes.acceptableUse],
    ["AI", clientAgreementVersion, legalConfig.routes.ai],
    ["MSA", clientAgreementVersion, legalConfig.routes.clientServices],
    ["MANAGED_SERVICES", clientAgreementVersion, legalConfig.routes.clientServices],
    ["PRICING_SCHEDULE", clientAgreementVersion, legalConfig.routes.clientServices],
    ["DPA", clientAgreementVersion, legalConfig.routes.clientServices],
    ["SECURITY", clientAgreementVersion, legalConfig.routes.clientServices],
    ["PAYMENTS", clientAgreementVersion, legalConfig.routes.clientServices],
  ];

  return spec
    .filter(([type]) => typeof sources[type] === "string")
    .map(([documentType, version, path]) => ({
      id: `${documentType}:${version}`,
      documentType,
      version,
      effectiveAt: effectiveDate,
      contentHashSha256: contentHash(sources[documentType] as string),
      renderedHtmlPath: path,
      status,
    }));
}

/**
 * The version identifiers an acceptance must capture (spec §5). Kept as one
 * function so every acceptance path records the same set.
 */
export function currentVersionSet() {
  const { publicPolicyVersion, clientAgreementVersion, pricingVersion } =
    legalConfig.legal;
  return {
    msaVersion: clientAgreementVersion,
    dpaVersion: clientAgreementVersion,
    aiScheduleVersion: clientAgreementVersion,
    paymentsScheduleVersion: clientAgreementVersion,
    aupVersion: clientAgreementVersion,
    publicPolicyVersion,
    pricingVersion,
  };
}
