import { notFound } from "next/navigation";
import { loadClientWorkspace } from "@/lib/ops/clientsData";
import { ClientWorkspaceView } from "./ClientWorkspaceView";

export const dynamic = "force-dynamic";

export default async function ClientWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await loadClientWorkspace(id);
  if (!c) notFound();
  return <ClientWorkspaceView id={id} c={c} />;
}
