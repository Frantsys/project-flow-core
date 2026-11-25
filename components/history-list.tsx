import { describeHistory, timeAgo } from "@/lib/history-format";
import { roleLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { UserAvatar } from "@/components/user-avatar";
import type { HistoryEntryDTO } from "@/server/db/types";

/** Lista de alterações do workspace: "Marina alterou o status de A Fazer para Revisão em PF-31 …". */
export function HistoryList({ entries, showRole = false }: { entries: HistoryEntryDTO[]; showRole?: boolean }) {
  if (entries.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Nenhuma alteração registrada ainda.</p>;
  }

  return (
    <ItemGroup>
      {entries.map((entry) => (
        <Item key={entry.id} size="sm" className="items-start px-0">
          <ItemMedia>
            <UserAvatar name={entry.user?.name ?? "?"} image={entry.user?.image} size="sm" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="block font-normal leading-snug">
              <span className="font-medium">{entry.user?.name ?? "Conta removida"}</span>{" "}
              {showRole && (
                <Badge variant="outline" className="mr-1 h-5 align-middle text-[11px]">
                  {roleLabel[entry.actorRole]}
                </Badge>
              )}
              {describeHistory(entry)} <span className="font-medium">{entry.details.targetTitle}</span>
            </ItemTitle>
            <ItemDescription className="text-xs">{timeAgo(entry.createdAt)}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
