"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { loginSchema } from "@/server/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { OAuthButtons } from "./oauth-buttons";

const WRONG_CREDENTIALS = "E-mail ou senha incorretos. Confira os dados ou redefina a senha.";

const PROVIDER_FAILED =
  "Não foi possível entrar com o Google ou o GitHub. Tente de novo ou use e-mail e senha.";

// Códigos que o NextAuth devolve na URL (?error=) depois de um login malsucedido
const URL_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "Este e-mail já está ligado a outra forma de login. Entre com o método usado no cadastro.",
  AccessDenied: "O acesso foi negado pelo provedor. Tente novamente.",
  OAuthSignin: PROVIDER_FAILED,
  OAuthCallback: PROVIDER_FAILED,
  OAuthCreateAccount: PROVIDER_FAILED,
  Callback: PROVIDER_FAILED,
  CredentialsSignin: WRONG_CREDENTIALS,
  SessionRequired: "Entre para continuar.",
};

/** Só aceita caminhos internos, para não redirecionar para outro site depois do login. */
function safeCallback(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/workspaces";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = safeCallback(params.get("callbackUrl"));
  const urlError = params.get("error");

  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(
    urlError ? (URL_ERRORS[urlError] ?? "Não foi possível entrar. Tente novamente.") : null
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({ email: errors.email?.[0], password: errors.password?.[0] });
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);

    const result = await signIn("credentials", { ...parsed.data, redirect: false });

    if (!result || result.error) {
      setPending(false);
      setFormError(WRONG_CREDENTIALS);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <div className="flex flex-col gap-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Entrar na sua conta</h1>
          <p className="text-sm text-muted-foreground">Use seu e-mail ou um provedor abaixo</p>
        </div>

        <OAuthButtons callbackUrl={callbackUrl} />

        <Field data-invalid={!!fieldErrors.email}>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nome@empresa.com"
            aria-invalid={!!fieldErrors.email}
          />
          <FieldError>{fieldErrors.email}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.password}>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!fieldErrors.password}
          />
          <FieldError>{fieldErrors.password}</FieldError>
        </Field>

        <Field>
          <FieldError>{formError}</FieldError>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Entrando…" : "Entrar"}
          </Button>
          <FieldDescription className="text-center">
            Não tem conta? <Link href="/auth/signup">Criar conta</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
