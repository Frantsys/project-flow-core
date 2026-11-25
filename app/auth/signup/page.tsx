import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  // o formulário lê ?callbackUrl, que só existe na requisição
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
