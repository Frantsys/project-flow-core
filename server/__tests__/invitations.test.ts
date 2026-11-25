import { describe, expect, it, vi } from "vitest";
import {
  acceptInvitationAction,
  inviteMemberAction,
  revokeInvitationAction,
  transferOwnershipAction,
} from "@/server/actions/member.actions";
import { Invitation, Workspace } from "@/server/db/models";
import { actAs, createUser, createWorkspace, expectFail, expectOk } from "../../test/helpers";

/** O e-mail sai no terminal nos testes: o link do convite é lido de lá. */
async function inviteAndGetToken(workspaceId: string, email: string, role: "ADMIN" | "MEMBER" = "MEMBER") {
  const spy = vi.spyOn(console, "info").mockImplementation(() => {});
  expectOk(await inviteMemberAction({ workspaceId, email, role }));
  const text = String(spy.mock.calls.at(-1)?.[0] ?? "");
  spy.mockRestore();
  const token = /invite\?token=([\w-]+)/.exec(text)?.[1];
  if (!token) throw new Error("Link do convite não encontrado no e-mail.");
  return token;
}

async function roles(workspaceId: string) {
  const ws = await Workspace.findById(workspaceId).lean();
  return Object.fromEntries(ws!.members.map((m) => [m.userId.toString(), m.role]));
}

describe("convites", () => {
  it("convidado aceita com o e-mail certo, uma única vez", async () => {
    const owner = await createUser("Dono");
    const guest = await createUser("Convidado");
    const ws = await createWorkspace(owner.id);
    actAs(owner.id);
    const token = await inviteAndGetToken(ws.id, guest.email, "ADMIN");

    actAs(guest.id);
    expect(expectOk(await acceptInvitationAction({ token })).slug).toBe(ws.slug);
    expect((await roles(ws.id))[guest.id]).toBe("ADMIN");
    expectFail(await acceptInvitationAction({ token }), "expirou ou já foi usado");
  });

  it("outra conta não usa um link repassado", async () => {
    const owner = await createUser("Dono");
    const intruder = await createUser("Intruso");
    const ws = await createWorkspace(owner.id);
    actAs(owner.id);
    const token = await inviteAndGetToken(ws.id, "convidada@teste.dev");

    actAs(intruder.id);
    expectFail(await acceptInvitationAction({ token }), "convidada@teste.dev");
    expect((await roles(ws.id))[intruder.id]).toBeUndefined();
  });

  it("reenviar troca o link; cancelar invalida; membro comum não convida", async () => {
    const owner = await createUser("Dono");
    const member = await createUser("Membro");
    const guest = await createUser("Convidado");
    const ws = await createWorkspace(owner.id, [{ userId: member.id, role: "MEMBER" }]);
    actAs(owner.id);
    const first = await inviteAndGetToken(ws.id, guest.email);
    const second = await inviteAndGetToken(ws.id, guest.email);
    expect(await Invitation.countDocuments()).toBe(1);

    expectFail(
      await inviteMemberAction({ workspaceId: ws.id, email: member.email, role: "MEMBER" }),
      "já é membro"
    );

    actAs(guest.id);
    expectFail(await acceptInvitationAction({ token: first }), "expirou");

    actAs(owner.id);
    const invitation = await Invitation.findOne().lean();
    expectOk(await revokeInvitationAction({ workspaceId: ws.id, invitationId: invitation!._id.toString() }));
    actAs(guest.id);
    expectFail(await acceptInvitationAction({ token: second }), "expirou");

    actAs(member.id);
    expectFail(
      await inviteMemberAction({ workspaceId: ws.id, email: "x@teste.dev", role: "MEMBER" }),
      "permissão"
    );
  });
});

describe("transferência de posse", () => {
  it("o dono passa a posse e vira admin; ninguém mais consegue", async () => {
    const owner = await createUser("Dono");
    const admin = await createUser("Admin");
    const outsider = await createUser("Fora");
    const ws = await createWorkspace(owner.id, [{ userId: admin.id, role: "ADMIN" }]);

    actAs(admin.id);
    expectFail(await transferOwnershipAction({ workspaceId: ws.id, userId: admin.id }), "permissão");

    actAs(owner.id);
    expectFail(await transferOwnershipAction({ workspaceId: ws.id, userId: outsider.id }), "não é membro");
    expectOk(await transferOwnershipAction({ workspaceId: ws.id, userId: admin.id }));

    expect(await roles(ws.id)).toEqual({ [owner.id]: "ADMIN", [admin.id]: "OWNER" });
    expect((await Workspace.findById(ws.id).lean())!.ownerId.toString()).toBe(admin.id);
    expectFail(await transferOwnershipAction({ workspaceId: ws.id, userId: admin.id }), "permissão");
  });
});
