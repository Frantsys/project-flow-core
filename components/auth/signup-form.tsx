"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { signUpSchema } from "@/server/schemas";
import { signUpAction } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { OAuthButtons } from "./oauth-buttons";
import { safeCallback } from "./login-form";

type FieldName = "username" | "email" | "password" | "confirmPassword";
type Errors = Partial<Record<FieldName, string>>;

const FIELDS: {
  name: FieldName;
  label: string;
  type: string;
  autoComplete: string;
  placeholder?: string;
  help?: string;
}[] = [
  { name: "username", label: "Nome", type: "text", autoComplete: "name", placeholder: "Seu nome" },
  { name: "email", label: "E-mail", type: "email", autoComplete: "email", placeholder: "nome@empresa.com" },
  {
    name: "password",
    label: "Senha",
    type: "password",
    autoComplete: "new-password",
    help: "Mínimo de 8 caracteres.",
  },
  { name: "confirmPassword", label: "Confirmar senha", type: "password", autoComplete: "new-password" },
];

function firstErrors(fieldErrors: Record<string, string[] | undefined> = {}): Errors {
  return Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0]]));
}

export function SignupForm() {
  const router = useRouter();
  // volta para onde a pessoa ia (ex.: um convite) depois de criar a conta
  const callbackUrl = safeCallback(useSearchParams().get("callbackUrl"));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = signUpSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      setErrors(firstErrors(z.flattenError(parsed.error).fieldErrors));
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);

    const result = await signUpAction(parsed.data);
    if (!result.success) {
      setPending(false);
      setErrors(firstErrors(result.fieldErrors));
      setFormError(result.error);
      return;
    }

    const login = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });

    // Conta criada, mas o login automático falhou: manda para o login em vez de travar aqui
    router.push(login && !login.error ? callbackUrl : "/auth/login");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <div className="flex flex-col gap-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
          <p className="text-sm text-muted-foreground">Leva menos de um minuto</p>
        </div>

        <OAuthButtons callbackUrl={callbackUrl} />

        {FIELDS.map((f) => (
          <Field key={f.name} data-invalid={!!errors[f.name]}>
            <FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
            <Input
              id={f.name}
              name={f.name}
              type={f.type}
              autoComplete={f.autoComplete}
              placeholder={f.placeholder}
              aria-invalid={!!errors[f.name]}
            />
            {errors[f.name] ? (
              <FieldError>{errors[f.name]}</FieldError>
            ) : (
              f.help && <FieldDescription>{f.help}</FieldDescription>
            )}
          </Field>
        ))}

        <Field>
          <FieldError>{formError}</FieldError>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Criando conta…" : "Criar conta"}
          </Button>
          <FieldDescription className="text-center text-xs">
            Ao criar a conta você concorda com os <Link href="/terms">Termos de uso</Link> e a{" "}
            <Link href="/privacy">Política de privacidade</Link>.
          </FieldDescription>
          <FieldDescription className="text-center">
            Já tem conta?{" "}
            <Link href={`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Entrar</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
