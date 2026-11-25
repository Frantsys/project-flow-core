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
  EmailNotVerified:
    "O e-mail dessa conta não está verificado no provedor. Verifique o e-mail lá ou entre com e-mail e senha.",
};

/** Só aceita caminhos internos, para não redirecionar para outro site depois do login. */
export function safeCallback(value: string | null) {
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
  // segundo passo: a senha estava certa e a conta tem verificação em duas etapas
  const [pendingLogin, setPendingLogin] = useState<{ email: string; password: string } | null>(null);
  const [code, setCode] = useState("");

  /** Tenta entrar; devolve true se entrou. Trata os erros que o authorize pode mandar. */
  async function attempt(data: { email: string; password: string; code?: string }) {
    setFormError(null);
    setPending(true);
    const result = await signIn("credentials", { ...data, redirect: false });

    if (result && !result.error) {
      router.push(callbackUrl);
      router.refresh();
      return;
    }
    setPending(false);
    const error = result?.error ?? "";
    if (error === "TWO_FACTOR_REQUIRED") {
      setPendingLogin({ email: data.email, password: data.password });
      return;
    }
    // limite de tentativas e código errado têm mensagem própria; o resto é genérico
    setFormError(
      error.startsWith("Muitas tentativas") || error.startsWith("Código de verificação")
        ? error
        : WRONG_CREDENTIALS
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({ email: errors.email?.[0], password: errors.password?.[0] });
      return;
    }

    setFieldErrors({});
    await attempt(parsed.data);
  }

  if (pendingLogin) {
    return (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) void attempt({ ...pendingLogin, code: code.trim() });
        }}
      >
        <FieldGroup>
          <div className="flex flex-col gap-1.5 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Verificação em duas etapas</h1>
            <p className="text-sm text-muted-foreground">
              Digite o código de 6 dígitos do seu aplicativo autenticador, ou um código de recuperação.
            </p>
          </div>
          <Field data-invalid={!!formError}>
            <FieldLabel htmlFor="code">Código</FieldLabel>
            <Input
              id="code"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-invalid={!!formError}
            />
            <FieldError>{formError}</FieldError>
          </Field>
          <Field>
            <Button type="submit" disabled={pending || !code.trim()}>
              {pending && <Spinner />}
              {pending ? "Verificando…" : "Verificar e entrar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPendingLogin(null);
                setCode("");
                setFormError(null);
              }}
            >
              Voltar
            </Button>
          </Field>
        </FieldGroup>
      </form>
    );
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
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <Link
              href="/auth/forgot"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Esqueci a senha
            </Link>
          </div>
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
            Não tem conta?{" "}
            <Link href={`/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Criar conta</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
