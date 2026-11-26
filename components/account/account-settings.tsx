"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import { z } from "zod";
import { requestPasswordResetAction, resendVerificationAction } from "@/server/actions/auth.actions";
import {
  changePasswordAction,
  deleteAccountAction,
  signOutEverywhereAction,
  updateNotificationPrefsAction,
  updateProfileAction,
} from "@/server/actions/account.actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TwoFactorCard } from "./two-factor-card";
import { changePasswordSchema } from "@/server/schemas";
import type { AccountDTO } from "@/server/services/account.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
] as const;

export function AccountSettings({ account }: { account: AccountDTO }) {
  const sections = [
    { id: "perfil", label: "Perfil", card: <ProfileCard name={account.name} /> },
    {
      id: "email",
      label: "E-mail",
      card: <EmailCard email={account.email} verified={account.emailVerified} />,
    },
    {
      id: "notificacoes",
      label: "Notificações",
      card: <NotificationsCard notifyByEmail={account.notifyByEmail} />,
    },
    {
      id: "senha",
      label: "Senha",
      card: <PasswordCard email={account.email} hasPassword={account.hasPassword} />,
    },
    // a verificação em duas etapas protege o login com senha; sem senha não há o que proteger
    ...(account.hasPassword
      ? [
          {
            id: "duas-etapas",
            label: "Duas etapas",
            card: (
              <TwoFactorCard
                enabled={account.twoFactorEnabled}
                recoveryCodesLeft={account.recoveryCodesLeft}
              />
            ),
          },
        ]
      : []),
    { id: "contas", label: "Contas", card: <ProvidersCard providers={account.providers} /> },
    { id: "sessoes", label: "Sessões", card: <SessionsCard /> },
    {
      id: "excluir",
      label: "Excluir",
      card: <DeleteAccountCard email={account.email} ownedWorkspaces={account.ownedWorkspaces} />,
    },
  ];

  // as seções chegam por streaming, depois de o navegador procurar a âncora: rola aqui (/account#senha)
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, []);

  return (
    // só esta tela precisa do provider: é ele que atualiza o nome guardado na sessão
    <SessionProvider>
      {/* página longa: o índice fica preso no topo e leva direto a cada seção (o link também serve
          para mandar alguém para /account#senha) */}
      <nav
        aria-label="Seções da conta"
        className="sticky top-0 z-10 -mx-2 -mt-2 bg-sidebar/95 px-2 py-2 backdrop-blur supports-backdrop-filter:bg-sidebar/80"
      >
        <ul className="flex gap-1.5 overflow-x-auto">
          {sections.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm whitespace-nowrap text-text-secondary outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex flex-col gap-6">
        {sections.map((s) => (
          // scroll-mt: a seção para abaixo do índice preso, não atrás dele
          <div key={s.id} id={s.id} className="scroll-mt-16">
            {s.card}
          </div>
        ))}
      </div>
    </SessionProvider>
  );
}

function ProfileCard({ name }: { name: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = String(new FormData(event.currentTarget).get("username") ?? "");
    setPending(true);
    const result = await updateProfileAction({ username });
    if (result.success) await update({ name: result.data.username });
    setPending(false);

    if (!result.success) return setError(result.fieldErrors?.username?.[0] ?? result.error);
    setError(null);
    toast.success("Nome atualizado.");
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="contents">
        <CardHeader>
          <CardTitle className="font-semibold">Perfil</CardTitle>
          <CardDescription>Como o seu nome aparece para o time.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="username">Nome</FieldLabel>
            <Input
              id="username"
              name="username"
              defaultValue={name}
              autoComplete="name"
              aria-invalid={!!error}
            />
            <FieldError>{error}</FieldError>
          </Field>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            Salvar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function EmailCard({ email, verified }: { email: string; verified: boolean }) {
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const result = await resendVerificationAction({});
    setPending(false);
    if (result.success) toast.success(`Enviamos um novo link para ${email}.`);
    else toast.error(result.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold">E-mail</CardTitle>
        <CardDescription>Usado para entrar e para recuperar a senha.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{email}</span>
        {verified ? (
          <Badge variant="success">Confirmado</Badge>
        ) : (
          <Badge variant="warning">Não confirmado</Badge>
        )}
      </CardContent>
      {!verified && (
        <CardFooter>
          <Button variant="outline" onClick={resend} disabled={pending}>
            {pending && <Spinner />}
            Reenviar link de confirmação
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

type PasswordErrors = Partial<Record<"currentPassword" | "password" | "confirmPassword", string>>;

function PasswordCard({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [pending, setPending] = useState(false);

  async function sendSetupLink() {
    setPending(true);
    const result = await requestPasswordResetAction({ email });
    setPending(false);
    if (result.success) toast.success(`Enviamos um link para ${email} criar a senha.`);
    else toast.error(result.error);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      const fe = z.flattenError(parsed.error).fieldErrors;
      return setErrors({
        currentPassword: fe.currentPassword?.[0],
        password: fe.password?.[0],
        confirmPassword: fe.confirmPassword?.[0],
      });
    }
    setPending(true);
    const result = await changePasswordAction(parsed.data);
    setPending(false);
    if (!result.success) {
      setErrors({ currentPassword: result.fieldErrors?.currentPassword?.[0] });
      if (!result.fieldErrors) toast.error(result.error);
      return;
    }
    setErrors({});
    form.reset();
    // a troca encerrou todas as sessões, esta também: entra de novo com a senha nova
    await signOut({ callbackUrl: "/auth/login?error=PasswordChanged" });
  }

  if (!hasPassword) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Senha</CardTitle>
          <CardDescription>
            Você entra pelo Google ou GitHub. Para também entrar com e-mail e senha, enviaremos um link para
            criar a senha.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={sendSetupLink} disabled={pending}>
            {pending && <Spinner />}
            Enviar link para criar senha
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const fields = [
    { name: "currentPassword", label: "Senha atual", autoComplete: "current-password" },
    { name: "password", label: "Nova senha", autoComplete: "new-password" },
    { name: "confirmPassword", label: "Confirmar nova senha", autoComplete: "new-password" },
  ] as const;

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="contents">
        <CardHeader>
          <CardTitle className="font-semibold">Senha</CardTitle>
          <CardDescription>Use pelo menos 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {fields.map((f) => (
              <Field key={f.name} data-invalid={!!errors[f.name]}>
                <FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
                <Input
                  id={f.name}
                  name={f.name}
                  type="password"
                  autoComplete={f.autoComplete}
                  aria-invalid={!!errors[f.name]}
                />
                <FieldError>{errors[f.name]}</FieldError>
              </Field>
            ))}
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            Alterar senha
          </Button>
          <Button variant="link" type="button" onClick={sendSetupLink} disabled={pending}>
            Esqueci a senha atual
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function ProvidersCard({ providers }: { providers: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold">Contas conectadas</CardTitle>
        <CardDescription>Entre com um clique usando o Google ou o GitHub.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {PROVIDERS.map((p) => {
          const connected = providers.includes(p.id);
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <span className="text-sm font-medium">{p.label}</span>
              {connected ? (
                <Badge variant="success">Conectado</Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={() => signIn(p.id, { callbackUrl: "/account" })}>
                  Conectar
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function DeleteAccountCard({
  email,
  ownedWorkspaces,
}: {
  email: string;
  ownedWorkspaces: AccountDTO["ownedWorkspaces"];
}) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const blocked = ownedWorkspaces.length > 0;

  async function onDelete(event: React.MouseEvent) {
    event.preventDefault(); // mantém o diálogo aberto enquanto a exclusão roda
    setPending(true);
    const result = await deleteAccountAction({ email: typed });
    if (!result.success) {
      setPending(false);
      toast.error(result.error);
      return;
    }
    await signOut({ callbackUrl: "/auth/login" });
  }

  return (
    <Card className="border-destructive-border">
      <CardHeader>
        <CardTitle className="font-semibold text-danger-fg">Excluir conta</CardTitle>
        <CardDescription>
          Você sai de todos os workspaces e as tarefas atribuídas a você ficam sem responsável. Comentários e
          histórico continuam, sem o seu nome. Não pode ser desfeito.
        </CardDescription>
      </CardHeader>
      {blocked && (
        <CardContent className="text-sm">
          <p className="mb-2">Antes, exclua os workspaces de que você é dono:</p>
          <ul className="list-disc pl-5">
            {ownedWorkspaces.map((w) => (
              <li key={w.slug}>
                <Link className="underline underline-offset-4" href={`/w/${w.slug}/settings`}>
                  {w.name}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
      <CardFooter>
        <AlertDialog onOpenChange={(open) => !open && setTyped("")}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={blocked}>
              Excluir conta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
              <AlertDialogDescription>
                Sua conta e o acesso a todos os workspaces serão removidos. Não é possível desfazer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field>
              <FieldLabel htmlFor="confirm-email">
                Digite <span className="font-mono">{email}</span> para confirmar
              </FieldLabel>
              <Input
                id="confirm-email"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={typed.trim().toLowerCase() !== email || pending}
                onClick={onDelete}
              >
                {pending && <Spinner />}
                Excluir conta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

function NotificationsCard({ notifyByEmail }: { notifyByEmail: boolean }) {
  const [checked, setChecked] = useState(notifyByEmail);
  const [pending, setPending] = useState(false);

  async function toggle(next: boolean) {
    setChecked(next);
    setPending(true);
    const result = await updateNotificationPrefsAction({ notifyByEmail: next });
    setPending(false);
    if (!result.success) {
      setChecked(!next);
      toast.error(result.error);
      return;
    }
    toast.success(next ? "Você vai receber e-mails de notificação." : "E-mails de notificação desligados.");
  }

  return (
    <Card id="notificacoes">
      <CardHeader>
        <CardTitle className="font-semibold">Notificações</CardTitle>
        <CardDescription>Tudo aparece no sino. Por e-mail, só o que pede ação sua.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3">
          <Checkbox
            id="notify-email"
            checked={checked}
            disabled={pending}
            onCheckedChange={(v) => toggle(v === true)}
          />
          <div className="grid gap-1">
            <Label htmlFor="notify-email">Receber por e-mail</Label>
            <p className="text-sm text-muted-foreground">
              Quando atribuírem uma tarefa a você ou mencionarem você com @ num comentário.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const [pending, setPending] = useState(false);

  async function signOutEverywhere() {
    setPending(true);
    const result = await signOutEverywhereAction({});
    if (!result.success) {
      setPending(false);
      toast.error(result.error);
      return;
    }
    await signOut({ callbackUrl: "/auth/login?error=SessionRevoked" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold">Sessões</CardTitle>
        <CardDescription>
          Esqueceu a conta aberta num computador emprestado ou perdeu o celular? Encerre todas as sessões;
          você entra de novo aqui em seguida. Trocar a senha também encerra todas.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" onClick={signOutEverywhere} disabled={pending}>
          {pending && <Spinner />}
          Sair de todos os dispositivos
        </Button>
      </CardFooter>
    </Card>
  );
}
