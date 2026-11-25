import type { ComponentProps, ElementType } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown dos documentos (com tabelas e checklists do GFM). Seguro por padrão: o react-markdown
 * não interpreta HTML do texto e limpa links perigosos (javascript:), então não há XSS a tratar.
 */

/** Elemento com as classes do app; tira o `node` que o react-markdown passa e não é atributo HTML. */
function styled<T extends ElementType>(Tag: T, className: string) {
  function Styled({ node: _node, ...props }: ComponentProps<T> & ExtraProps) {
    const Element = Tag as ElementType;
    return <Element className={className} {...props} />;
  }
  return Styled;
}

const components: Components = {
  h1: styled("h1", "mt-8 mb-3 text-2xl font-semibold tracking-tight first:mt-0"),
  h2: styled("h2", "mt-7 mb-2.5 text-xl font-semibold tracking-tight first:mt-0"),
  h3: styled("h3", "mt-6 mb-2 text-lg font-semibold first:mt-0"),
  p: styled("p", "my-3 leading-7"),
  ul: styled("ul", "my-3 list-disc pl-6 [&.contains-task-list]:list-none [&.contains-task-list]:pl-1"),
  ol: styled("ol", "my-3 list-decimal pl-6"),
  li: styled("li", "my-1 leading-7 [&>input]:mr-2 [&>input]:align-middle"),
  blockquote: styled("blockquote", "my-4 border-l-2 border-border-strong pl-4 text-text-secondary"),
  pre: styled("pre", "my-4 overflow-x-auto rounded-md bg-muted p-4 text-[13px] leading-6"),
  th: styled("th", "border border-border bg-muted px-3 py-1.5 text-left font-semibold"),
  td: styled("td", "border border-border px-3 py-1.5"),
  hr: () => <hr className="my-6 border-border" />,
  a: ({ node: _node, href, ...props }) => (
    <a
      href={href}
      className="font-medium text-info-fg underline underline-offset-4"
      {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    />
  ),
  code: ({ node: _node, className, ...props }) => (
    <code
      // com className é bloco de código (dentro de <pre>); sem, é código no meio do texto
      className={
        className
          ? `${className} font-mono text-[13px]`
          : "rounded-sm bg-muted px-1 py-0.5 font-mono text-[13px]"
      }
      {...props}
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[15px] text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
