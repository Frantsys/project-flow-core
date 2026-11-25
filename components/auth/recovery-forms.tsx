"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { CheckCircle2, MailCheck } from "lucide-react";
import {
  requestPasswordResetAction,
  resetPasswordAction,
  verifyEmailAction,
} from "@/server/actions/auth.actions";
import { forgotPasswordSchema, resetPasswordSchema } from "@/server/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Done({
  icon: Icon,
  title,
  text,
  href,
  cta,
}: {
  icon: typeof MailCheck;
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center" role="status">
      <Icon className="size-10 text-primary" aria-hidden="true" />
      <Heading title={title} text={text} />
      <Button asChild variant="outline" className="w-full">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}

const BackToLogin = () => (
  <FieldDescription className="text-center">
    Lembrou a senha? <Link href="/auth/login">Entrar</Link>
  </FieldDescription>
);

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setError(z.flattenError(parsed.error).fieldErrors.email?.[0] ?? "Informe um e-mail válido.");
      return;
    }
    setError(null);
    setPending(true);
    const result = await requestPasswordResetAction(parsed.data);
    setPending(false);
    if (!result.success) return setError(result.error);
    setSentTo(parsed.data.email);
  }

  if (sentTo) {
    return (
      <Done
        icon={MailCheck}
        title="Confira seu e-mail"
        text={`Se existir uma conta com ${sentTo}, enviamos um link para redefinir a senha. Ele vale por 30 minutos.`}
        href="/auth/login"
        cta="Voltar para o login"
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Heading title="Esqueceu a senha?" text="Enviaremos um link para você criar uma nova" />
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nome@empresa.com"
            aria-invalid={!!error}
          />
          <FieldError>{error}</FieldError>
        </Field>
        <Field>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Enviando…" : "Enviar link"}
          </Button>
          <BackToLogin />
        </Field>
      </FieldGroup>
    </form>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse({
      token,
      ...Object.fromEntries(new FormData(event.currentTarget)),
    });
    if (!parsed.success) {
      const fe = z.flattenError(parsed.error).fieldErrors;
      setErrors({ password: fe.password?.[0], confirmPassword: fe.confirmPassword?.[0] });
      if (fe.token) setFormError(fe.token[0] ?? null);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const result = await resetPasswordAction(parsed.data);
    setPending(false);
    if (!result.success) return setFormError(result.error);
    setDone(true);
  }

  if (done) {
    return (
      <Done
        icon={CheckCircle2}
        title="Senha redefinida"
        text="Entre com o seu e-mail e a nova senha."
        href="/auth/login"
        cta="Ir para o login"
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Heading title="Criar nova senha" text="Use pelo menos 8 caracteres" />
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Nova senha</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
          />
          <FieldError>{errors.password}</FieldError>
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">Confirmar nova senha</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
          />
          <FieldError>{errors.confirmPassword}</FieldError>
        </Field>
        <Field>
          <FieldError>{formError}</FieldError>
          {formError && (
            <FieldDescription>
              <Link href="/auth/forgot">Pedir um novo link</Link>
            </FieldDescription>
          )}
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Salvando…" : "Salvar nova senha"}
          </Button>
          <BackToLogin />
        </Field>
      </FieldGroup>
    </form>
  );
}

/** Confirmação por botão, e não ao abrir a página: antivírus de e-mail abrem links sozinhos. */
export function VerifyEmailCard() {
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState<string | null>(token ? null : "Link inválido.");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const result = await verifyEmailAction({ token });
    setPending(false);
    if (!result.success) return setError(result.error);
    setDone(true);
  }

  if (done) {
    return (
      <Done
        icon={CheckCircle2}
        title="E-mail confirmado"
        text="Tudo certo. Você já pode continuar de onde parou."
        href="/workspaces"
        cta="Ir para os workspaces"
      />
    );
  }

  return (
    <FieldGroup>
      <Heading title="Confirmar e-mail" text="Clique abaixo para confirmar que este e-mail é seu" />
      <Field>
        <FieldError>{error}</FieldError>
        <Button onClick={confirm} disabled={pending || !token}>
          {pending && <Spinner />}
          {pending ? "Confirmando…" : "Confirmar e-mail"}
        </Button>
        <FieldDescription className="text-center">
          <Link href="/account">Ir para Minha conta</Link>
        </FieldDescription>
      </Field>
    </FieldGroup>
  );
}
