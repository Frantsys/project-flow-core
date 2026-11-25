/**
 * Regra de segurança do login social: só aceitamos (e vinculamos a uma conta existente) um
 * e-mail que o provedor confirme como verificado. Sem isso, quem cadastrasse no GitHub um e-mail
 * alheio, sem verificar, entraria na conta dessa pessoa, já que as contas são ligadas pelo e-mail.
 */

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export function isVerifiedOAuthEmail(input: {
  provider: string;
  email: string | null | undefined;
  googleEmailVerified?: unknown;
  githubEmails?: GitHubEmail[];
}): boolean {
  const email = input.email?.trim().toLowerCase();
  if (!email) return false;

  switch (input.provider) {
    case "google":
      return input.googleEmailVerified === true;
    case "github":
      return (input.githubEmails ?? []).some((e) => e.verified && e.email.trim().toLowerCase() === email);
    default:
      // provedores novos ficam bloqueados até alguém escrever a regra deles
      return false;
  }
}

/** Lista os e-mails da conta GitHub (o escopo user:email já vem no provider padrão). */
export async function fetchGitHubEmails(accessToken: string): Promise<GitHubEmail[]> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return [];
  return (await res.json()) as GitHubEmail[];
}
