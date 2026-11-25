import { ImageResponse } from "next/og";

export const alt = "Project Flow: projetos, sprints e documentos do time no mesmo fluxo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagem que aparece ao compartilhar o link (WhatsApp, LinkedIn, Slack). */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#171717",
        color: "#fafafa",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 36, fontWeight: 600 }}>
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fafafa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M8 7v7M12 7v4M16 7v9" />
        </svg>
        Project Flow
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>
          Projetos, sprints e documentos do time no mesmo fluxo.
        </div>
        <div style={{ fontSize: 30, color: "#a3a3a3" }}>
          Quadro kanban · Sprints · Relatórios · Documentos
        </div>
      </div>
    </div>,
    size
  );
}
