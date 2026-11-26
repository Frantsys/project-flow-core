import { Suspense } from "react";
import Link from "next/link";
import { Building2, ListChecks } from "lucide-react";
import { requireUser } from "@/lib/session";
import { CommandMenuButton } from "@/components/command-menu";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const LINKS = [
  { href: "/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/my-work", label: "Minhas tarefas", icon: ListChecks },
] as const;

/**
 * Cabeçalho das telas fora de um workspace (Workspaces, Minhas tarefas, Notificações, Minha conta):
 * os mesmos itens no mesmo lugar em todas, com a tela atual marcada.
 */
export function AppHeader({ current }: { current?: (typeof LINKS)[number]["href"] }) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b bg-background px-4 sm:px-6">
      <Logo />
      <div className="flex items-center gap-1 sm:gap-2">
        <CommandMenuButton className="hidden w-56 md:flex" />
        <nav aria-label="Principal" className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Button
              key={href}
              asChild
              variant="ghost"
              className="aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
            >
              <Link href={href} aria-current={current === href ? "page" : undefined} aria-label={label}>
                <Icon aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            </Button>
          ))}
        </nav>
        <NotificationBell />
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <Account />
        </Suspense>
      </div>
    </header>
  );
}

async function Account() {
  return <UserMenu user={await requireUser()} />;
}
