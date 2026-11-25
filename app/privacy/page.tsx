import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Quais dados o Project Flow guarda, para quê, com quem compartilha e como excluir.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade" updated="25 de novembro de 2026">
      <p>
        O Project Flow é um projeto de portfólio. Esta página explica, em linguagem simples, quais dados ele
        guarda, para quê e como você controla esses dados, conforme a Lei Geral de Proteção de Dados (LGPD).
      </p>

      <h2>Dados que guardamos</h2>
      <ul>
        <li>
          <strong>Conta:</strong> nome, e-mail, senha (só o resumo criptográfico, nunca a senha em si) e, se
          você entrar com Google ou GitHub, o identificador e a foto dessa conta.
        </li>
        <li>
          <strong>Conteúdo:</strong> workspaces, projetos, tarefas, comentários, documentos e o histórico de
          alterações que você e seu time criam.
        </li>
        <li>
          <strong>Segurança:</strong> o endereço IP é usado para limitar tentativas de login e de cadastro e
          fica guardado por no máximo uma hora. Links de recuperação de senha e de convite são guardados só
          como resumo criptográfico e expiram.
        </li>
        <li>
          <strong>Uso:</strong> estatísticas de visitas e de desempenho sem cookies e sem identificar você
          (Vercel Web Analytics e Speed Insights).
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <p>
        Para fazer o app funcionar: entrar na sua conta, mostrar o trabalho do seu time, avisar você de
        atribuições e menções e proteger a conta contra abuso. Não vendemos dados e não usamos seus dados para
        publicidade.
      </p>

      <h2>Cookies</h2>
      <p>
        Só os necessários: um cookie de sessão que mantém você logado e um de proteção contra falsificação de
        requisições. A preferência de tema (claro ou escuro) fica no seu navegador.
      </p>

      <h2>Com quem os dados são processados</h2>
      <ul>
        <li>Vercel: hospedagem do app (funções em São Paulo).</li>
        <li>MongoDB Atlas: banco de dados (São Paulo).</li>
        <li>Resend: envio dos e-mails de confirmação, convite e notificação.</li>
        <li>Google e GitHub: só se você escolher entrar com eles.</li>
      </ul>

      <h2>Seus direitos</h2>
      <p>
        Em <Link href="/account">Minha conta</Link> você corrige seu nome, troca a senha, desliga os e-mails
        de notificação e exclui a conta. Ao excluir, a conta e os vínculos com workspaces são apagados;
        comentários e histórico continuam nos workspaces do time, sem o seu nome.
      </p>
      <p>
        Notificações ficam guardadas por 90 dias. O conteúdo de um workspace é apagado quando o dono exclui o
        workspace.
      </p>
    </LegalPage>
  );
}
