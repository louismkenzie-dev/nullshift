/**
 * Business vault — pure rules. Nothing here touches the database or sees a
 * stored value; it decides what may be saved and how a value is shown when
 * it is not being revealed.
 */

export const MAX_NAME = 120;
export const MAX_VALUE = 2000;
export const MAX_NOTE = 500;

/**
 * The last four characters, so two records can be told apart on the list
 * without revealing either. Short values show nothing at all rather than
 * most of themselves — a 4-digit PIN must not be "hinted" in full.
 */
export function hintFor(value: string): string | null {
  const v = value.trim();
  if (v.length < 8) return null;
  return v.slice(-4);
}

/** What the list shows in place of a value. */
export function maskFor(hint: string | null | undefined): string {
  return hint ? `•••• ${hint}` : "••••••••";
}

/**
 * Returns the problem to show the operator, or null when the record is fine.
 * A new record must carry a value — an empty one is a label pretending to be
 * a record. Editing may leave the value box blank to keep the current value.
 */
export function validateRecord(input: {
  name: string;
  value: string;
  isNew: boolean;
}): string | null {
  const name = input.name.trim();
  if (!name) return "Give the record a name.";
  if (name.length > MAX_NAME) return `Keep the name under ${MAX_NAME} characters.`;
  if (input.isNew && !input.value.trim()) return "Enter the value you want to store.";
  if (input.value.length > MAX_VALUE)
    return `That value is too long (limit ${MAX_VALUE} characters).`;
  return null;
}
