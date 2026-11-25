"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createDocumentAction } from "@/server/actions/document.actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Cria um documento "Sem título" e abre no editor. */
export function NewDocumentButton({
  workspaceId,
  workspaceSlug,
  parentId = null,
  projectId = null,
  children,
  ...buttonProps
}: {
  workspaceId: string;
  workspaceSlug: string;
  parentId?: string | null;
  projectId?: string | null;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      {...buttonProps}
      disabled={pending || buttonProps.disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await createDocumentAction({ workspaceId, parentId, projectId });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          router.push(`/w/${workspaceSlug}/docs/${result.data.id}`);
          router.refresh();
        })
      }
    >
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}
