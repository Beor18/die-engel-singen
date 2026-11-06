/**
 * El adorno de líneas y estrella que encabeza cada significado. Los trazos son
 * los mismos del PDF: 98 puntos de línea a cada lado y una estrella de cuatro
 * puntas en el centro, sobre una página de 540 de ancho.
 */
export function Adorno({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="160 -9.5 220 19" aria-hidden="true" focusable="false">
      <path className="adorno-linea adorno-izquierda" d="M258 0H160" stroke="currentColor" strokeWidth="0.65" fill="none" />
      <path className="adorno-linea adorno-derecha" d="M282 0H380" stroke="currentColor" strokeWidth="0.65" fill="none" />
      <path
        className="adorno-estrella"
        d="M270 -9C269 -2 267 -1 263 0C267 1 269 2 270 9C271 2 273 1 277 0C273 -1 271 -2 270 -9Z"
        fill="currentColor"
      />
    </svg>
  );
}
