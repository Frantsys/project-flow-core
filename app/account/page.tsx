import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getAccount } from "@/server/services/account.service";
import { AccountSettings } from "@/components/account/account-settings";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Minha conta" };

export default function AccountPage() {
  return (
    <div className="min-h-svh bg-sidebar">
      <header className="flex h-14 items-center justify-between border-b bg-background px-6">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/workspaces">
            <ArrowLeft aria-hidden="true" />
            Workspaces
          </Link>
        </Button>
      </header>
      <main className="mx-auto flex max-w-[720px] flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Minha conta</h1>
          <p className="text-sm text-muted-foreground">Perfil, acesso e segurança da sua conta.</p>
        </div>
        <Suspense fallback={<AccountSkeleton />}>
          <AccountContent />
        </Suspense>
      </main>
    </div>
  );
}

async function AccountContent() {
  const user = await requireUser();
  const account = await getAccount(user.id);
  if (!account) redirect("/auth/login");
  return <AccountSettings account={account} />;
}

function AccountSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}
