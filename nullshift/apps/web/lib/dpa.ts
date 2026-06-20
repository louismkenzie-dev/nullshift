/**
 * DPA-declaration helpers. The client provides their Data Processing Agreement
 * details in the portal (business type, the personal data they'll collect,
 * special-category use, and — for limited companies — their legal company name,
 * number and registered office). These pure predicates decide whether they've
 * finished (gates the portal + the admin "send" button) and whether they've
 * actually submitted (drives the admin status display).
 */
export type DpaProjectFields = {
  client_entity_type: string | null;
  dpa_client_company_name: string | null;
  dpa_client_company_number: string | null;
  dpa_client_registered_address: string | null;
  dpa_personal_data: string | null;
  dpa_special_category: boolean | null;
  dpa_special_category_detail: string | null;
  dpa_client_submitted_at?: string | null;
};

/** Everything the DPA needs is present, by business type. */
export function dpaComplete(p: DpaProjectFields): boolean {
  if (p.client_entity_type !== "limited" && p.client_entity_type !== "sole_trader")
    return false;
  if (!p.dpa_personal_data) return false;
  if (p.dpa_special_category && !p.dpa_special_category_detail) return false;
  if (p.client_entity_type === "limited") {
    if (
      !p.dpa_client_company_name ||
      !p.dpa_client_company_number ||
      !p.dpa_client_registered_address
    )
      return false;
  }
  return true;
}

/** The client has actually submitted their declaration (vs admin-pre-filled). */
export function dpaSubmitted(p: DpaProjectFields): boolean {
  return !!p.dpa_client_submitted_at;
}

/** Ready for the admin to generate + send the documents: the client has
 *  submitted and everything required is present. */
export function dpaReadyToSend(p: DpaProjectFields): boolean {
  return dpaSubmitted(p) && dpaComplete(p);
}
