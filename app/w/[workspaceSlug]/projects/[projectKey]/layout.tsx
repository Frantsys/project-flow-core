/** `modal` recebe a tarefa aberta por cima do quadro/backlog (rota interceptada em @modal). */
export default function ProjectLayout({
  children,
  modal,
}: LayoutProps<"/w/[workspaceSlug]/projects/[projectKey]">) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
