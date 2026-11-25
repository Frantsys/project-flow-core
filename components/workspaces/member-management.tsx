"use client";

import { can, canChangeRole, canRemoveMember } from "@/lib/permissions";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  transferOwnershipAction,
  updateMemberRoleAction,
} from "@/server/actions/member.actions";
import type { PendingInvitationDTO } from "@/server/services/invitation.service";
import { fullDate } from "@/lib/labels";
import { roleLabel } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { WorkspaceRole } from "@/server/db/models";

type Role = "ADMIN" | "MEMBER";

/** Convida alguém por e-mail; a pessoa entra no workspace ao aceitar o link, com ou sem conta. */
export function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await inviteMemberAction({ workspaceId, email, role });
          if (!result.success) {
            setError(result.fieldErrors?.email?.[0] ?? result.error);
            return;
          }
          setError(undefined);
          setEmail("");
          toast.success(`Convite enviado para ${result.data.email}.`);
          router.refresh();
        });
      }}
    >
      <div className="flex w-full flex-wrap items-end gap-2">
        <Field data-invalid={!!error} className="min-w-0 flex-[1_1_260px]">
          <FieldLabel htmlFor="member-email">Convidar pessoa por e-mail</FieldLabel>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@empresa.com"
            aria-invalid={!!error}
            aria-describedby={error ? "member-email-error" : "member-email-help"}
            required
          />
        </Field>
        <Field className="w-36">
          <FieldLabel htmlFor="member-role">Papel</FieldLabel>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger id="member-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEMBER">{roleLabel.MEMBER}</SelectItem>
              <SelectItem value="ADMIN">{roleLabel.ADMIN}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Button type="submit" disabled={pending || !email}>
          {pending && <Spinner />}
          Convidar
        </Button>
      </div>
      {error ? (
        <FieldError id="member-email-error">{error}</FieldError>
      ) : (
        <p id="member-email-help" className="text-[13px] text-muted-foreground">
          Enviaremos um link válido por 7 dias. Quem ainda não tem conta cria uma ao aceitar.
        </p>
      )}
    </form>
  );
}

interface MemberActionsProps {
  workspaceId: string;
  member: { id: string; name: string; role: WorkspaceRole };
  currentUser: { id: string; role: WorkspaceRole };
}

/**
 * Papel e remoção de um membro. Segue as regras do servidor: o dono não muda; admin não
 * mexe em outro admin; qualquer um pode sair do workspace.
 */
export function MemberActions({ workspaceId, member, currentUser }: MemberActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isSelf = member.id === currentUser.id;
  const canEditRole = canChangeRole(currentUser.role, member.role, isSelf);
  const canRemove = canRemoveMember(currentUser.role, member.role, isSelf);
  const canTransfer = can(currentUser.role, "workspace.transfer") && !isSelf;

  function run(
    action: () => Promise<{ success: true } | { success: false; error: string }>,
    message: string,
    after?: () => void
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {pending && <Spinner className="text-muted-foreground" />}
      {canEditRole && (
        <Select
          value={member.role}
          onValueChange={(role) =>
            run(
              () => updateMemberRoleAction({ workspaceId, userId: member.id, role: role as Role }),
              `${member.name} agora é ${roleLabel[role as Role]}.`
            )
          }
        >
          <SelectTrigger size="sm" aria-label={`Papel de ${member.name}`} className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MEMBER">{roleLabel.MEMBER}</SelectItem>
            <SelectItem value="ADMIN">{roleLabel.ADMIN}</SelectItem>
          </SelectContent>
        </Select>
      )}
      {canTransfer && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm">
              Tornar dono
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Passar a posse para {member.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {member.name} vira dono do workspace e você passa a ser admin. Só o novo dono pode excluir o
                workspace ou devolver a posse.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  run(
                    () => transferOwnershipAction({ workspaceId, userId: member.id }),
                    `${member.name} agora é o dono do workspace.`
                  )
                }
              >
                Passar a posse
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {canRemove && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive-text">
              {isSelf ? "Sair" : "Remover"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{isSelf ? "Sair do workspace?" : `Remover ${member.name}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                {isSelf
                  ? "Você perde o acesso aos projetos e documentos. Para voltar, alguém precisa convidar você de novo."
                  : `${member.name} perde o acesso aos projetos e documentos. As tarefas atribuídas continuam com o nome dessa pessoa.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  run(
                    () => removeMemberAction({ workspaceId, userId: member.id }),
                    isSelf ? "Você saiu do workspace." : `${member.name} foi removido.`,
                    isSelf ? () => router.push("/workspaces") : undefined
                  )
                }
              >
                {isSelf ? "Sair do workspace" : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

/** Convites enviados e ainda válidos, com reenvio e cancelamento. */
export function PendingInvitations({
  workspaceId,
  invitations,
}: {
  workspaceId: string;
  invitations: PendingInvitationDTO[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ success: true } | { success: false; error: string }>,
    message: string
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) return void toast.error(result.error);
      toast.success(message);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="pending-invites" className="flex flex-col gap-2 p-4">
      <h2 id="pending-invites" className="text-sm font-semibold">
        Convites pendentes ({invitations.length})
      </h2>
      <ul className="flex flex-col divide-y">
        {invitations.map((inv) => (
          <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{inv.email}</span>
            <span className="text-xs text-muted-foreground">
              {roleLabel[inv.role]} · vence em {fullDate(inv.expiresAt)}
              {inv.invitedBy && ` · por ${inv.invitedBy}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => inviteMemberAction({ workspaceId, email: inv.email, role: inv.role }),
                  `Convite reenviado para ${inv.email}.`
                )
              }
            >
              Reenviar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive-text"
              disabled={pending}
              onClick={() =>
                run(
                  () => revokeInvitationAction({ workspaceId, invitationId: inv.id }),
                  `Convite para ${inv.email} cancelado.`
                )
              }
            >
              Cancelar
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
