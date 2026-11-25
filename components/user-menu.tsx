"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { LogOut, Palette, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "./user-avatar";
import type { CurrentUser } from "@/lib/session";

/** Menu da conta: só o avatar no topo da página de Workspaces, avatar + nome na sidebar. */
export function UserMenu({ user, showName = false }: { user: CurrentUser; showName?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {showName ? (
          <Button variant="ghost" className="h-12 w-full justify-start gap-2.5 px-2">
            <UserAvatar name={user.name} image={user.image} />
            <span className="flex min-w-0 flex-1 flex-col items-start">
              <span className="truncate">{user.name}</span>
              <span className="text-xs font-normal text-muted-foreground">Conta e sair</span>
            </span>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Menu da conta" className="rounded-full">
            <UserAvatar name={user.name} image={user.image} size="lg" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span>{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound aria-hidden="true" />
            Minha conta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette aria-hidden="true" />
            Tema
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">Claro</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Escuro</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">Do sistema</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/auth/login" })}>
          <LogOut aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
