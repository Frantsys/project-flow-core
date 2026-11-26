import "server-only";

/**
 * URL pública do app para os links dos e-mails. Nunca usa o cabeçalho Host da requisição:
 * um Host forjado mandaria o link de redefinição de senha para outro domínio.
 */
export function appUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  const host =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

interface Email {
  to: string;
  subject: string;
  /** Parágrafo de abertura. */
  intro: string;
  action: { label: string; url: string };
  /** Linha final, em cinza (ex.: validade do link). */
  footnote: string;
}

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ENTITIES[c]!);

function render({ intro, action, footnote }: Email) {
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:system-ui,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #e4e4e7;border-radius:8px">
<tr><td style="padding:32px">
<p style="margin:0 0 24px;font-weight:600">Project Flow</p>
<p style="margin:0 0 24px;line-height:1.6">${escape(intro)}</p>
<a href="${escape(action.url)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:500">${escape(action.label)}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717a">${escape(footnote)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${intro}\n\n${action.label}: ${action.url}\n\n${footnote}`;
  return { html, text };
}

/**
 * Envia pela API HTTP da Resend. Sem RESEND_API_KEY, fora de produção, só escreve o e-mail no
 * terminal (para testar os fluxos localmente); em produção, a falta da chave é um erro.
 */
export async function sendEmail(email: Email) {
  const { html, text } = render(email);
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    // EMAIL_LOG=1: build de produção nos testes ponta a ponta, sem Resend
    if (process.env.NODE_ENV === "production" && process.env.EMAIL_LOG !== "1") {
      throw new Error("RESEND_API_KEY não configurada.");
    }
    console.info(`[email] para ${email.to} · ${email.subject}\n${text}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Project Flow <onboarding@resend.dev>",
      to: email.to,
      subject: email.subject,
      html,
      text,
    }),
  });
  if (!response.ok) throw new Error(`Resend respondeu ${response.status}: ${await response.text()}`);
}
