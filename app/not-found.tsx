import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-sidebar p-6">
      <Empty className="max-w-md border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Página não encontrada</EmptyTitle>
          <EmptyDescription>
            O endereço pode estar errado, ou o item foi excluído, ou você não tem acesso a ele.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/workspaces">Ir para os workspaces</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
