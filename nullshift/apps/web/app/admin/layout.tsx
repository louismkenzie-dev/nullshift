import type { Metadata } from "next";

// Internal ops hub — keep it out of search indexes. (Previously the admin app's
// own root layout; now a thin segment layout under the consolidated web app.)
export const metadata: Metadata = {
  title: "Nullshift — Ops Hub",
  description: "Internal operations hub for Nullshift staff.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
