import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras de uso do Project Flow.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage title="Termos de uso" updated="25 de novembro de 2026">
      <p>
        O Project Flow é um projeto de portfólio, oferecido gratuitamente e sem garantia de disponibilidade.
        Ao criar uma conta você concorda com estes termos.
      </p>

      <h2>Sua conta</h2>
      <ul>
        <li>Use um e-mail que seja seu e mantenha a senha em segredo.</li>
        <li>Você é responsável pelo que faz na sua conta e pelo conteúdo que publica.</li>
        <li>O dono de um workspace decide quem entra e quais papéis cada pessoa tem.</li>
      </ul>

      <h2>Uso aceitável</h2>
      <p>Não use o Project Flow para:</p>
      <ul>
        <li>publicar conteúdo ilegal, ofensivo ou que viole direitos de outras pessoas;</li>
        <li>tentar acessar contas ou workspaces que não são seus;</li>
        <li>sobrecarregar o serviço, automatizar cadastros ou enviar convites em massa.</li>
      </ul>
      <p>Contas que descumprirem essas regras podem ser suspensas ou excluídas.</p>

      <h2>Seus dados</h2>
      <p>
        O conteúdo que você cria continua sendo seu. O tratamento dos dados está descrito na{" "}
        <Link href="/privacy">Política de privacidade</Link>.
      </p>

      <h2>Mudanças e encerramento</h2>
      <p>
        Por ser um projeto de portfólio, o serviço pode mudar, ficar fora do ar ou ser encerrado. Você pode
        excluir sua conta a qualquer momento em <Link href="/account">Minha conta</Link>.
      </p>
    </LegalPage>
  );
}
