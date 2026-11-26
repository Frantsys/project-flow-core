import { Suspense } from "react";
import { Reveal } from "@/components/reveal";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getInvitationPreview } from "@/server/services/invitation.service";
import { InviteCard } from "@/components/workspaces/invite-card";
import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Convite", referrer: "no-referrer" };

export default function InvitePage({ searchParams }: PageProps<"/invite">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-sidebar p-6">
      <Logo />
      <main className="w-full max-w-[420px]">
        <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
          <Reveal>
            <Invite searchParams={searchParams} />
          </Reveal>
        </Suspense>
      </main>
    </div>
  );
}

async function Invite({ searchParams }: { searchParams: PageProps<"/invite">["searchParams"] }) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  // quem não está logado já foi mandado ao login pelo proxy, com volta para cá.
  // a sessão vem antes: ler cookies marca a página como dinâmica, e a busca usa a hora atual
  const user = await requireUser();
  const preview = await getInvitationPreview(value);
  return <InviteCard token={value} preview={preview} currentEmail={user.email} />;
}
