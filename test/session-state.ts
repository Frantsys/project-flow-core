let userId: string | null = null;
let demo = false;

/** Define quem está "logado" para as próximas chamadas de action (null = deslogado). */
export function actAs(id: string | null, options: { demo?: boolean } = {}) {
  userId = id;
  demo = !!options.demo;
}

export function currentUserId() {
  return userId;
}

export function currentIsDemo() {
  return demo;
}
