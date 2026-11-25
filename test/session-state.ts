let userId: string | null = null;

/** Define quem está "logado" para as próximas chamadas de action (null = deslogado). */
export function actAs(id: string | null) {
  userId = id;
}

export function currentUserId() {
  return userId;
}
