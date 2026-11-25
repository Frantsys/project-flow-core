"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { acceptInvitationAction } from "@/server/actions/member.actions";
import type { InvitationPreviewDTO } from "@/server/services/invitation.service";
import { roleLabel } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

export function InviteCard({
  token,
  preview,
  currentEmail,
}: {
  token: string;
  preview: InvitationPreviewDTO | null;
  currentEmail: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!preview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Convite inválido</CardTitle>
          <CardDescription>
            Este convite expirou, foi cancelado ou já foi usado. Peça um novo a quem convidou você.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href="/workspaces">Ir para os workspaces</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const wrongAccount = preview.email !== currentEmail.toLowerCase();

  async function accept() {
    setPending(true);
    const result = await acceptInvitationAction({ token });
    if (!result.success) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.push(result.data.slug ? `/w/${result.data.slug}` : "/workspaces");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold">Entrar em {preview.workspaceName}</CardTitle>
        <CardDescription>
          {wrongAccount
            ? `Este convite foi enviado para ${preview.email}, mas você entrou como ${currentEmail}.`
            : `Você foi convidado como ${roleLabel[preview.role]}.`}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex-col items-stretch gap-3">
        <FieldError>{error}</FieldError>
        {wrongAccount ? (
          <Button
            onClick={() =>
              signOut({
                callbackUrl: `/auth/login?callbackUrl=${encodeURIComponent(`/invite?token=${token}`)}`,
              })
            }
          >
            Entrar com {preview.email}
          </Button>
        ) : (
          <Button onClick={accept} disabled={pending}>
            {pending && <Spinner />}
            Aceitar convite
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
