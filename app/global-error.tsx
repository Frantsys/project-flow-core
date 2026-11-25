"use client";

/** Último recurso: o próprio layout raiz falhou, então nada de componentes do app aqui. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
        }}
      >
        <main style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ color: "#666", marginBottom: 20 }}>
            O Project Flow não conseguiu carregar. Tente de novo.
          </p>
          <button
            onClick={reset}
            style={{ padding: "8px 16px", borderRadius: 6, background: "#171717", color: "#fff", border: 0 }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
