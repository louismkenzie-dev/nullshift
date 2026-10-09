"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { APP_AREA } from "@/components/auth/areas";

export default function AppLoginPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", background: "var(--k-bg)" }} />}
    >
      <LoginForm area={APP_AREA} />
    </Suspense>
  );
}
