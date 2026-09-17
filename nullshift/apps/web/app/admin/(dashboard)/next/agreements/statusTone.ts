import type { AgreementStatus } from "@/lib/next/fixtures-agreements";
import s from "../next.module.css";

/** Chip tone per status: every one of the eight statuses reads distinctly. */
export const statusTone = (status: AgreementStatus): string => {
  switch (status) {
    case "Accepted":
      return s.chipSuccess;
    case "Needs internal review":
    case "Awaiting client":
      return s.chipWarning;
    case "Rejected":
      return s.chipDanger;
    case "Ready to issue":
      return s.chipInfo;
    default:
      return "";
  }
};
