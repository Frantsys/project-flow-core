import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  // LoginForm lê ?callbackUrl e ?error, que só existem na requisição
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
