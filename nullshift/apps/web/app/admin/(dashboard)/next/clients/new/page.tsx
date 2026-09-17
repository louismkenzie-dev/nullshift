import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { clientCreationEnabled, operationsSession } from "@/lib/next/live-data";
import { NewClientWizard } from "./NewClientWizard";
import s from "../../next.module.css";

export default async function NewClientPage() {
  const { staff } = await operationsSession();
  return (
    <>
      <Link href="/admin/next/clients" className={s.backLink}>
        <ArrowLeft size={14} /> All clients
      </Link>
      <div className={s.pageHead}>
        <div>
          <p className={s.eyebrow}>A clear start</p>
          <h1 className={s.h1}>Add a client.</h1>
          <p className={s.lead}>The essentials first. The details when you need them.</p>
        </div>
      </div>
      <NewClientWizard
        draftId={randomUUID()}
        projectId={randomUUID()}
        owner={staff.email ?? ""}
        enabled={clientCreationEnabled()}
      />
    </>
  );
}
