import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/recovery-forms";

export const metadata: Metadata = { title: "Nova senha", referrer: "no-referrer" };

export default function ResetPasswordPage() {
  // o formulário lê ?token, que só existe na requisição
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
