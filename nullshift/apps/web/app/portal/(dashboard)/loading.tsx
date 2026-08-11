import { NullshiftLoader } from "@/components/app/NullshiftLoader";

/** Route-level loading state — the Nullshift scramble while queries run. */
export default function Loading() {
  return <NullshiftLoader />;
}
