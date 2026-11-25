"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, KeyRound } from "lucide-react";
import { createApiTokenAction, revokeApiTokenAction } from "@/server/actions/api-token.actions";
import type { ApiTokenDTO } from "@/server/services/public-api.service";
import { fullDate } from "@/lib/labels";
import { timeAgo } from "@/lib/history-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** Tokens da API pública: criar (o valor aparece uma vez), ver o uso e revogar. */
export function ApiTokens({
  workspaceId,
  tokens,
  origin,
}: {
  workspaceId: string;
  tokens: ApiTokenDTO[];
  origin: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const copy = (text: string, message: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast.success(message),
      () => toast.error("Não foi possível copiar. Selecione e copie manualmente.")
    );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">API pública</CardTitle>
          <CardDescription>
            Tokens dão leitura aos projetos e tarefas deste workspace para integrações, planilhas e scripts.
            Referência:{" "}
            <a className="underline underline-offset-4" href="/api/v1/openapi.json">
              /api/v1/openapi.json
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await createApiTokenAction({ workspaceId, name });
                if (!result.success) return setError(result.fieldErrors?.name?.[0] ?? result.error);
                setError(null);
                setName("");
                setCreated(result.data.token);
                router.refresh();
              });
            }}
          >
            <Field data-invalid={!!error} className="min-w-0 flex-[1_1_240px]">
              <FieldLabel htmlFor="token-name">Nome do token</FieldLabel>
              <Input
                id="token-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Planilha de acompanhamento"
                aria-invalid={!!error}
              />
            </Field>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Spinner />}
              Criar token
            </Button>
            {error && <FieldError className="w-full">{error}</FieldError>}
          </form>

          {created && (
            <div
              role="status"
              className="flex flex-col gap-2 rounded-md border border-warning-fg/30 bg-warning-bg p-3 text-sm text-warning-fg"
            >
              <p className="font-medium">Copie o token agora: ele não aparece de novo.</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-sm bg-background px-2 py-1 font-mono text-[13px] text-foreground">
                  {created}
                </code>
                <Button size="sm" variant="outline" onClick={() => copy(created, "Token copiado.")}>
                  <Copy aria-hidden="true" />
                  Copiar
                </Button>
              </div>
              <p>Exemplo:</p>
              <code className="block overflow-x-auto rounded-sm bg-background px-2 py-1 font-mono text-[12px] whitespace-pre text-foreground">
                {`curl -H "Authorization: Bearer ${created}" ${origin}/api/v1/projects`}
              </code>
            </div>
          )}

          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum token criado.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {tokens.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">{t.name}</span>
                  <code className="font-mono text-xs text-muted-foreground">{t.prefix}…</code>
                  <span className="ml-auto text-xs text-muted-foreground">
                    criado em {fullDate(t.createdAt)} ·{" "}
                    {t.lastUsedAt ? `usado ${timeAgo(t.lastUsedAt)}` : "nunca usado"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive-text"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await revokeApiTokenAction({ workspaceId, tokenId: t.id });
                        if (!result.success) return void toast.error(result.error);
                        toast.success(`Token “${t.name}” revogado.`);
                        router.refresh();
                      })
                    }
                  >
                    Revogar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
