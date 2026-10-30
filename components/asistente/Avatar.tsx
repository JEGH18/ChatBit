// Avatar propio del prototipo ("Neo"): burbuja de conversación con cara amable. No usa logotipos oficiales.
export function AvatarNeo({ className = "size-10", etiqueta = true }: { className?: string; etiqueta?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={etiqueta ? "img" : undefined}
      aria-hidden={etiqueta ? undefined : true}
      aria-label={etiqueta ? "Neo, asistente virtual" : undefined}
    >
      <circle cx="24" cy="24" r="24" fill="var(--neo-morado)" />
      <path d="M12 15a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6h-7l-6 5v-5a5 5 0 0 1-5-5z" fill="var(--neo-verde)" />
      <circle cx="19.5" cy="19" r="2.2" fill="var(--neo-morado)" />
      <circle cx="28.5" cy="19" r="2.2" fill="var(--neo-morado)" />
      <path d="M19.5 24.5q4.5 3.5 9 0" stroke="var(--neo-morado)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
