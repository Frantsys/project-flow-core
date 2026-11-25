import { Suspense } from "react";
import type { Metadata } from "next";
import { VerifyEmailCard } from "@/components/auth/recovery-forms";

export const metadata: Metadata = { title: "Confirmar e-mail", referrer: "no-referrer" };

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailCard />
    </Suspense>
  );
}
