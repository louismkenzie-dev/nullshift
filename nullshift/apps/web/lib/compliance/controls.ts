/**
 * The per-tenant GDPR controls staff record by hand (compliance_records
 * kinds). The DPA signature is deliberately not here — it has its own write
 * path (recordDpa on the Docs and Legal tile, or the portal acceptance).
 */
export const GDPR_CONTROLS: { kind: string; label: string; hint: string }[] = [
  {
    kind: "data_register",
    label: "Data-processing register entry",
    hint: "The client's processing activities are entered in the Article 30 register.",
  },
  {
    kind: "backup_check",
    label: "Last backup verified",
    hint: "A restore of this client's database was tested — an availability control (SOC 2 AVL-02).",
  },
];
