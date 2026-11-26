import { toast } from "sonner";
import { restoreTrashItemAction } from "@/server/actions/trash.actions";

/** Aviso de "foi para a lixeira" com o botão Desfazer, que restaura na hora. */
export function undoToast(message: string, trashId: string, onRestored: (id: string) => void) {
  toast.success(message, {
    duration: 8000,
    action: {
      label: "Desfazer",
      onClick: async () => {
        const result = await restoreTrashItemAction({ trashId });
        if (!result.success) return void toast.error(result.error);
        toast.success("Restaurado.");
        onRestored(result.data.id);
      },
    },
  });
}
