import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace, requireUser } from "@/lib/session";
import { fullDate, roleLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { DeleteWorkspaceCard, RenameWorkspaceForm } from "@/components/workspaces/workspace-settings-forms";

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

async function Settings({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ workspaceSlug }, { tab }] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const workspace = await getWorkspace(workspaceSlug, user.id);
  if (!workspace) notFound();

  const role = workspace.currentUserRole;
  const info = { id: workspace.id, name: workspace.name, slug: workspace.slug };

  return (
    <Tabs defaultValue={tab === "membros" || role === "MEMBER" ? "membros" : "geral"} className="gap-5">
      <TabsList>
        {role !== "MEMBER" && <TabsTrigger value="geral">Geral</TabsTrigger>}
        <TabsTrigger value="membros">Membros</TabsTrigger>
      </TabsList>

      {role !== "MEMBER" && (
        <TabsContent value="geral" className="flex flex-col gap-4">
          <RenameWorkspaceForm workspace={info} />
          {role === "OWNER" && (
            <DeleteWorkspaceCard
              workspace={info}
              projectsCount={workspace.stats.projectsCount}
              membersCount={workspace.stats.membersCount}
            />
          )}
        </TabsContent>
      )}

      <TabsContent value="membros">
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Membro</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="pr-5">Entrou em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={member.name} image={member.image} />
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{roleLabel[member.role]}</Badge>
                  </TableCell>
                  <TableCell className="pr-5 text-text-secondary">{fullDate(member.joinedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
