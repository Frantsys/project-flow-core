"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Field, FieldSeparator } from "@/components/ui/field";

export function OAuthButtons({ callbackUrl }: { callbackUrl: string }) {
  return (
    <>
      <Field className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" onClick={() => signIn("google", { callbackUrl })}>
          Continuar com Google
        </Button>
        <Button type="button" variant="outline" onClick={() => signIn("github", { callbackUrl })}>
          Continuar com GitHub
        </Button>
      </Field>
      <FieldSeparator>ou continue com e-mail</FieldSeparator>
    </>
  );
}
