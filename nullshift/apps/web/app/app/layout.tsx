import type { Metadata } from "next";
import { OperationOverlay } from "@/components/app/OperationOverlay";

// Self-serve product console — authenticated surface, keep it out of search.
export const metadata: Metadata = {
  title: "Nullshift — Products",
  description: "Your Nullshift products: Quote, Legal, Watch, Plans and Studio.",
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <OperationOverlay />
    </>
  );
}
