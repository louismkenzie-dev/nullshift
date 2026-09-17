/**
 * Client next actions (brief §5.4).
 *
 * Pure model and supersede semantics live in ./model (unit-tested). Server
 * actions (setNextAction, completeNextAction, listNextActions) live in
 * ./actions and are imported directly from there — a "use server" module is
 * not re-exported here so that pure consumers never pull in next/headers.
 */
export * from "./model";
