"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ShieldCheck } from "lucide-react";
import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  startTwoFactorAction,
} from "@/server/actions/account.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Stage =
  { name: "idle" } | { name: "scan"; qr: string; secret: string } | { name: "codes"; codes: string[] };

/**
 * Verificação em duas etapas: ler o QR no aplicativo autenticador, confirmar com um código e guardar
 * os códigos de recuperação. Vale para o login com e-mail e senha; Google e GitHub têm a própria.
 */
export function TwoFactorCard({
  enabled,
  recoveryCodesLeft,
}: {
  enabled: boolean;
  recoveryCodesLeft: number;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run<T>(
    action: () => Promise<
      { success: true; data: T } | { success: false; error: string; fieldErrors?: Record<string, string[]> }
    >,
    then: (data: T) => void
  ) {
    setPending(true);
    const result = await action();
    setPending(false);
    if (!result.success) return setError(result.fieldErrors?.code?.[0] ?? result.error);
    setError(null);
    setCode("");
    then(result.data);
  }

  const codeField = (label: string, help: string) => (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="two-factor-code">{label}</FieldLabel>
      <Input
        id="two-factor-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        className="max-w-48"
        aria-invalid={!!error}
      />
      {error ? <FieldError>{error}</FieldError> : <FieldDescription>{help}</FieldDescription>}
    </Field>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold">
          Verificação em duas etapas
          {enabled && stage.name !== "codes" && <Badge variant="success">Ligada</Badge>}
        </CardTitle>
        <CardDescription>
          Além da senha, o login pede um código do aplicativo autenticador do celular (Google Authenticator,
          Authy, 1Password…).
        </CardDescription>
      </CardHeader>

      {stage.name === "scan" && (
        <CardContent className="flex flex-col gap-4">
          <ol className="list-decimal pl-5 text-sm leading-6">
            <li>Abra o aplicativo autenticador e leia o QR code.</li>
            <li>Digite o código de 6 dígitos que aparecer.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor */}
            <img
              src={stage.qr}
              alt="QR code para o aplicativo autenticador"
              width={180}
              height={180}
              className="rounded-md border bg-white p-1"
            />
            <div className="text-sm">
              <p className="text-muted-foreground">Sem câmera? Digite esta chave no aplicativo:</p>
              <code className="mt-1 block rounded-sm bg-muted px-2 py-1 font-mono text-[13px] break-all">
                {stage.secret}
              </code>
            </div>
          </div>
          {codeField("Código do aplicativo", "O código muda a cada 30 segundos.")}
        </CardContent>
      )}

      {stage.name === "codes" && (
        <CardContent className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-medium text-success-fg">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Verificação ligada. Guarde os códigos de recuperação.
          </p>
          <p className="text-sm text-muted-foreground">
            Se perder o celular, cada código abaixo entra uma vez no lugar do código do aplicativo. Eles não
            aparecem de novo.
          </p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm sm:max-w-sm">
            {stage.codes.map((c) => (
              <li key={c} className="rounded-sm bg-muted px-2 py-1 text-center">
                {c}
              </li>
            ))}
          </ul>
        </CardContent>
      )}

      {stage.name === "idle" && enabled && (
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {recoveryCodesLeft === 1
              ? "Resta 1 código de recuperação."
              : `Restam ${recoveryCodesLeft} códigos de recuperação.`}
          </p>
          {codeField("Código para desligar", "Use o código do aplicativo ou um de recuperação.")}
        </CardContent>
      )}

      <CardFooter className="flex-wrap gap-2">
        {stage.name === "idle" && !enabled && (
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => startTwoFactorAction({}),
                (d) => setStage({ name: "scan", ...d })
              )
            }
          >
            {pending && <Spinner />}
            Ligar verificação
          </Button>
        )}
        {stage.name === "scan" && (
          <>
            <Button
              disabled={pending || !code.trim()}
              onClick={() =>
                run(
                  () => confirmTwoFactorAction({ code }),
                  (d) => setStage({ name: "codes", codes: d.recoveryCodes })
                )
              }
            >
              {pending && <Spinner />}
              Confirmar e ligar
            </Button>
            <Button variant="ghost" onClick={() => setStage({ name: "idle" })}>
              Cancelar
            </Button>
          </>
        )}
        {stage.name === "codes" && (
          <>
            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(stage.codes.join("\n")).then(
                  () => toast.success("Códigos copiados."),
                  () => toast.error("Não foi possível copiar. Anote os códigos.")
                )
              }
            >
              <Copy aria-hidden="true" />
              Copiar códigos
            </Button>
            <Button
              onClick={() => {
                setStage({ name: "idle" });
                router.refresh();
              }}
            >
              Já guardei
            </Button>
          </>
        )}
        {stage.name === "idle" && enabled && (
          <Button
            variant="outline"
            disabled={pending || !code.trim()}
            onClick={() =>
              run(
                () => disableTwoFactorAction({ code }),
                () => {
                  toast.success("Verificação em duas etapas desligada.");
                  router.refresh();
                }
              )
            }
          >
            {pending && <Spinner />}
            Desligar
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
