"use client";

// Último recurso: reemplaza incluso al layout raíz, así que trae sus propios estilos.
export default function ErrorGeneral({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 24,
          textAlign: "center",
          background: "#0b1318",
          color: "#f7f7f5",
          fontFamily: "Georgia, serif",
        }}
      >
        <h1 style={{ margin: 0, fontWeight: 400 }}>No se pudo abrir el libro.</h1>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 48,
            padding: "8px 22px",
            border: "1px solid #f7f7f5",
            background: "none",
            color: "#f7f7f5",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
