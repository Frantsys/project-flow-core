import { describe, expect, it } from "vitest";
import { createDocumentAction, updateDocumentAction } from "@/server/actions/document.actions";
import { DocumentModel } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectOk } from "../../test/helpers";

describe("edição simultânea de documentos", () => {
  it("o segundo a salvar sobre a mesma versão recebe a versão atual em vez de sobrescrever", async () => {
    const ana = await createUser("Ana");
    const bia = await createUser("Bia");
    const ws = await createWorkspace(ana.id, [{ userId: bia.id, role: "MEMBER" }]);
    actAs(ana.id);
    const { id } = expectOk(await createDocumentAction({ workspaceId: ws.id, title: "Ata" }));
    const opened = (await DocumentModel.findById(id).lean())!.updatedAt.toISOString();

    const first = expectOk(
      await updateDocumentAction({
        documentId: id,
        title: "Ata",
        content: "texto da Ana",
        baseUpdatedAt: opened,
      })
    );
    expect(first.saved).toBe(true);

    actAs(bia.id);
    const second = expectOk(
      await updateDocumentAction({
        documentId: id,
        title: "Ata",
        content: "texto da Bia",
        baseUpdatedAt: opened,
      })
    );
    expect(second).toMatchObject({ saved: false, current: { content: "texto da Ana" } });
    expect((await DocumentModel.findById(id).lean())!.content).toBe("texto da Ana");

    // a Bia decide manter a dela: salva sobre a versão que acabou de ver
    if (second.saved) throw new Error("esperava conflito");
    const forced = expectOk(
      await updateDocumentAction({
        documentId: id,
        title: "Ata",
        content: "texto da Bia",
        baseUpdatedAt: second.current.updatedAt,
      })
    );
    expect(forced.saved).toBe(true);
    expect((await DocumentModel.findById(id).lean())!.content).toBe("texto da Bia");
  });
});
