import type { Metadata } from "next";

// Client portal — authenticated surface, keep it out of search indexes.
// (Previously the portal app's own root layout; now a thin segment layout.)
export const metadata: Metadata = {
  title: "Nullshift — Client Portal",
  description: "Your Nullshift project: progress, approvals, deliverables, invoices.",
  robots: { index: false, follow: false },
};

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
