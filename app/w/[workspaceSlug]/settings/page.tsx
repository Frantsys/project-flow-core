import { can } from "@/lib/permissions";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace, requireUser } from "@/lib/session";
import { getWorkspaceHistory } from "@/server/services/history.service";
import { fullDate, roleLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { HistoryList } from "@/components/history-list";
import { DeleteWorkspaceCard, RenameWorkspaceForm } from "@/components/workspaces/workspace-settings-forms";
import {
  InviteMemberForm,
  MemberActions,
  PendingInvitations,
} from "@/components/workspaces/member-management";
import { getPendingInvitations } from "@/server/services/invitation.service";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage({ params, searchParams }: PageProps<"/w/[workspaceSlug]/settings">) {
  return (
    <div className="flex max-w-[980px] flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie o workspace, os membros e seus papéis.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
        <Settings params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const TABS = ["geral", "membros", "historico"] as const;

async function Settings({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ workspaceSlug }, { tab }] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const [workspace, history] = await Promise.all([
    getWorkspace(workspaceSlug, user.id),
    getWorkspaceHistory(workspaceSlug, user.id, 100),
  ]);
  if (!workspace || !history) notFound();

  const role = workspace.currentUserRole;
  const canManage = can(role, "workspace.update");
  const invitations = can(role, "member.manage") ? await getPendingInvitations(workspace.id) : [];
  const info = { id: workspace.id, name: workspace.name, slug: workspace.slug };
  const requested = TABS.find((t) => t === tab);
  const initial =
    requested && (requested !== "geral" || canManage) ? requested : canManage ? "geral" : "membros";

  return (
    <Tabs defaultValue={initial} className="gap-5">
      <TabsList>
        {canManage && <TabsTrigger value="geral">Geral</TabsTrigger>}
        <TabsTrigger value="membros">Membros</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>

      {canManage && (
        <TabsContent value="geral" className="flex flex-col gap-4">
          <RenameWorkspaceForm workspace={info} />
          {can(role, "workspace.delete") && (
            <DeleteWorkspaceCard
              workspace={info}
              projectsCount={workspace.stats.projectsCount}
              membersCount={workspace.stats.membersCount}
            />
          )}
        </TabsContent>
      )}

      <TabsContent value="membros">
        <Card className="gap-0 py-0">
          {canManage && (
            <>
              <InviteMemberForm workspaceId={workspace.id} />
              <Separator />
              {invitations.length > 0 && (
                <>
                  <PendingInvitations workspaceId={workspace.id} invitations={invitations} />
                  <Separator />
                </>
              )}
            </>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Membro</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Entrou em</TableHead>
                  <TableHead className="pr-5">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={member.name} image={member.image} />
                        <div>
                          <div className="font-medium">
                            {member.name}
                            {member.id === user.id && (
                              <span className="font-normal text-muted-foreground"> (você)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabel[member.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-text-secondary">{fullDate(member.joinedAt)}</TableCell>
                    <TableCell className="pr-5">
                      <MemberActions
                        workspaceId={workspace.id}
                        member={{ id: member.id, name: member.name, role: member.role }}
                        currentUser={{ id: user.id, role }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="historico">
        <Card>
          <CardContent>
            <HistoryList entries={history} showRole />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
