"use client";
import { useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Asistente } from "@/components/asistente/Asistente";
import { Button } from "@/components/ui/button";
import { GRABACIONES } from "@/lib/demo/grabaciones";
import { cn } from "@/lib/utils";
import { useReproduccion } from "./useReproduccion";

export function Demo() {
  const [cual, setCual] = useState(0);
  const [velocidad, setVelocidad] = useState(1);
  // key: al cambiar de persona, el reproductor empieza de cero.
  return <Reproductor key={cual} cual={cual} setCual={setCual} velocidad={velocidad} setVelocidad={setVelocidad} />;
}

function Reproductor({
  cual,
  setCual,
  velocidad,
  setVelocidad,
}: {
  cual: number;
  setCual: (i: number) => void;
  velocidad: number;
  setVelocidad: (f: (v: number) => number) => void;
}) {
  const g = GRABACIONES[cual];
  const r = useReproduccion(g, velocidad);

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border bg-[var(--neo-morado-claro)] px-3 py-2 sm:px-5" role="region" aria-label="Controles del modo demo">
        <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">MODO DEMO · sin conexión</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Persona de prueba">
          {GRABACIONES.map((x, i) => (
            <button
              key={x.persona.id}
              role="radio"
              aria-checked={i === cual}
              onClick={() => setCual(i)}
              title={x.persona.descripcion}
              className={cn("min-h-10 rounded-full border-2 px-3 text-sm font-semibold", i === cual ? "border-primary bg-primary text-primary-foreground" : "border-primary bg-background text-primary")}
            >
              {x.persona.nombre}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {r.reproduciendo ? (
            <Button size="sm" onClick={r.pausar}>
              <Pause aria-hidden /> Pausar
            </Button>
          ) : (
            <Button size="sm" onClick={r.reproducir} disabled={r.indice >= r.total}>
              <Play aria-hidden /> {r.indice === 0 ? "Reproducir" : "Continuar"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={r.reiniciar}>
            <RotateCcw aria-hidden /> Reiniciar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setVelocidad((v) => (v === 1 ? 2 : v === 2 ? 4 : 1))} title="Cambiar la velocidad">
            Velocidad {velocidad}×
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
            Paso {Math.min(r.indice + 1, r.total)} de {r.total}
          </span>
        </div>
        <p className="w-full text-sm text-[var(--neo-morado-oscuro)]">
          <strong>{g.persona.nombre}:</strong> {g.persona.descripcion}
          {r.nota && <span className="ml-2 rounded-md bg-background px-2 py-0.5 font-semibold">💡 {r.nota}</span>}
          <span className="ml-2 text-xs text-muted-foreground">
            Grabado {g.grabado} ({g.modo === "ia" ? "respuestas de Claude" : "motor guiado"}).
          </span>
        </p>
      </div>
      <div className="min-h-0 flex-1 [&>div]:h-full">
        <Asistente sesion={r.sesion} key={g.persona.id} />
      </div>
    </div>
  );
}
