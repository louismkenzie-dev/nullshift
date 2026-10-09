"use client";

import { Suspense } from "react";
import { SignupFlow } from "@/components/auth/SignupFlow";
import { APP_AREA } from "@/components/auth/areas";

export default function AppSignupPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", background: "var(--k-bg)" }} />}
    >
      <SignupFlow area={APP_AREA} />
    </Suspense>
  );
}
