/** Bare layout: no marketing chrome, no intro splash, no cookie banner — this
 *  document is embedded in other people's websites. */
export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
