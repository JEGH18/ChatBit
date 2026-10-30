"use client";
// Tarjetas enriquecidas que acompañan algunos mensajes del asistente.
import { useState } from "react";
import { CheckCircle2, Download, ExternalLink, MessageCircle, Pencil, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CONFIG, enlaceWhatsAppAsesor } from "@/lib/config";
import { construirRegistro, type EstadoConversacion } from "@/lib/conversacion/estado";
import type { Accion, Bloque } from "@/lib/conversacion/tipos";
import type { CampoId } from "@/lib/form/campos";
import { filasResumen } from "@/lib/form/presentacion";
import { PASOS } from "@/lib/form/campos";
import { cn } from "@/lib/utils";

type Props = {
  bloque: Bloque;
  activo: boolean;
  estado: EstadoConversacion;
  sesionId: string;
  enviarAccion: (a: Accion, texto?: string) => void;
  editarCampo: (c: CampoId) => void;
};

export function BloqueMensaje(p: Props) {
  switch (p.bloque.tipo) {
    case "opcionesCiiu":
      return <OpcionesCiiu {...p} bloque={p.bloque} />;
    case "calculoVentas":
      return (
        <div className="mt-3 rounded-xl border border-border bg-muted/60 p-3">
          <p className="text-sm font-semibold text-muted-foreground">Así hice la cuenta:</p>
          <ol className="mt-1 space-y-1 text-[0.95rem]">
            {p.bloque.pasos.map((paso, i) => (
              <li key={i} className="tabular-nums">
                {paso}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-lg font-bold tabular-nums">Total aproximado: ${p.bloque.total.toLocaleString("es-CO")}</p>
        </div>
      );
    case "consentimiento":
      return (
        <div className="mt-3 rounded-xl border border-border bg-muted/60 p-3">
          <ul className="list-disc space-y-1.5 pl-5 text-[0.95rem]">
            {p.bloque.vinetas.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
          <a
            href={p.bloque.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-semibold text-[var(--neo-verde-oscuro)] underline underline-offset-2"
          >
            Leer el texto completo <ExternalLink className="size-4" aria-hidden />
            <span className="sr-only">(abre en otra pestaña)</span>
          </a>
          <p className="mt-2 text-sm text-muted-foreground">La aceptación es siempre una decisión suya: nada se marca por defecto.</p>
        </div>
      );
    case "resumen":
      return <Resumen {...p} />;
    case "asesor":
      return (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="lg" className="bg-[#1f8f4e] text-white hover:bg-[#1a7a43]">
            <a href={enlaceWhatsAppAsesor()} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden /> Escribir por WhatsApp
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={`tel:${CONFIG.asesor.telefono.replace(/\s/g, "")}`}>
              <Phone aria-hidden /> Llamar al {CONFIG.asesor.telefono}
            </a>
          </Button>
        </div>
      );
    case "pasosCorreo":
      return (
        <ol className="mt-3 list-decimal space-y-1.5 rounded-xl border border-border bg-muted/60 p-3 pl-8 text-[0.95rem]">
          {p.bloque.pasos.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      );
    case "confirmacion":
      return <Confirmacion estado={p.estado} radicado={p.bloque.radicado} />;
    case "encuesta":
      return <Encuesta sesionId={p.sesionId} />;
  }
}

function OpcionesCiiu({ bloque, activo, enviarAccion }: Props & { bloque: Extract<Bloque, { tipo: "opcionesCiiu" }> }) {
  return (
    <div className="mt-3 space-y-2" role="group" aria-label="Actividades sugeridas">
      {bloque.opciones.map((o, i) => (
        <button
          key={o.codigo}
          type="button"
          disabled={!activo}
          onClick={() => enviarAccion({ tipo: "elegirCiiu", codigo: o.codigo }, `${o.codigo} - ${o.corto}`)}
          className={cn(
            "w-full rounded-xl border-2 border-border bg-card p-3 text-left transition-colors",
            activo && "hover:border-[var(--neo-verde-oscuro)] hover:bg-accent focus-visible:border-[var(--neo-verde-oscuro)]",
            !activo && "opacity-70",
          )}
        >
          <span className="flex items-baseline gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
            <span className="font-bold">{o.corto}</span>
            <span className="ml-auto rounded-md bg-muted px-1.5 text-sm font-semibold tabular-nums text-muted-foreground">CIIU {o.codigo}</span>
          </span>
          <span className="mt-1 block pl-9 text-[0.95rem]">{o.simple}</span>
          <span className="mt-0.5 block pl-9 text-xs text-muted-foreground">Nombre oficial: {o.descripcion}</span>
        </button>
      ))}
    </div>
  );
}

function Resumen({ estado, activo, editarCampo }: Props) {
  const filas = filasResumen(estado.valores, estado.omitidos);
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      {([1, 2] as const).map((paso) => (
        <section key={paso} aria-labelledby={`resumen-paso-${paso}`}>
          <h3 id={`resumen-paso-${paso}`} className="bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground">
            {PASOS[paso].titulo}
          </h3>
          <dl className="divide-y divide-border">
            {filas
              .filter((f) => f.paso === paso)
              .map((f) => (
                <div key={f.campo} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <dt className="text-xs text-muted-foreground">{f.etiqueta.replace(/^Al seleccionar, /, "")}</dt>
                    <dd className={cn("break-words font-semibold", !f.completo && "font-normal italic text-muted-foreground")}>{f.valor}</dd>
                  </div>
                  {activo && (
                    <Button variant="ghost" size="sm" onClick={() => editarCampo(f.campo)} aria-label={`Corregir ${f.etiqueta}`}>
                      <Pencil aria-hidden /> Corregir
                    </Button>
                  )}
                </div>
              ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function Confirmacion({ estado, radicado }: { estado: EstadoConversacion; radicado: string }) {
  const [ver, setVer] = useState(false);
  const registro = construirRegistro(estado, radicado);
  const json = JSON.stringify(registro, null, 2);
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `registro-${radicado}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="mt-3 rounded-xl border-2 border-[var(--neo-verde-oscuro)] bg-accent p-3">
      <p className="flex items-center gap-2 font-bold text-accent-foreground">
        <CheckCircle2 className="size-5" aria-hidden /> Registro generado (modo demostración)
      </p>
      <p className="mt-1 text-sm">En este prototipo no se envía nada a Neocrédito: se genera el JSON con la estructura del formulario.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={descargar}>
          <Download aria-hidden /> Descargar JSON
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setVer((v) => !v)} aria-expanded={ver}>
          {ver ? "Ocultar JSON" : "Ver JSON"}
        </Button>
      </div>
      {ver && <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-background p-2 text-xs">{json}</pre>}
    </div>
  );
}

const CARAS = [
  { valor: 1, emoji: "😞", etiqueta: "Mala" },
  { valor: 2, emoji: "😐", etiqueta: "Regular" },
  { valor: 3, emoji: "🙂", etiqueta: "Buena" },
] as const;

const RANGOS = ["Menos de 30", "30 a 44", "45 a 59", "60 o más", "Prefiero no decir"];

function Encuesta({ sesionId }: { sesionId: string }) {
  const [puntaje, setPuntaje] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [rango, setRango] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  if (enviada) return <p className="mt-3 font-semibold text-[var(--neo-verde-oscuro)]">¡Gracias! Su opinión nos ayuda a mejorar.</p>;

  const enviar = async () => {
    setEnviada(true);
    await fetch("/api/encuesta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sesionId, puntaje, comentario: comentario.trim() || undefined, rangoEdad: rango ?? undefined }),
    }).catch(() => undefined);
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/60 p-3">
      <div role="radiogroup" aria-label="¿Cómo le pareció el asistente?" className="flex gap-2">
        {CARAS.map((c) => (
          <button
            key={c.valor}
            type="button"
            role="radio"
            aria-checked={puntaje === c.valor}
            onClick={() => setPuntaje(c.valor)}
            className={cn(
              "flex min-h-16 flex-1 flex-col items-center justify-center rounded-xl border-2 bg-card text-sm font-semibold",
              puntaje === c.valor ? "border-[var(--neo-verde-oscuro)] bg-accent" : "border-border",
            )}
          >
            <span className="text-3xl" aria-hidden>
              {c.emoji}
            </span>
            {c.etiqueta}
          </button>
        ))}
      </div>
      <label className="block text-sm font-semibold">
        Comentario (opcional)
        <Textarea value={comentario} onChange={(e) => setComentario(e.target.value.slice(0, 500))} className="mt-1 bg-card" rows={2} />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">Opcional y anónimo: ¿en qué rango de edad está?</legend>
        <p className="text-xs text-muted-foreground">Solo para saber si el asistente funciona igual de bien para todas las edades. No queda en su registro.</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {RANGOS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={rango === r}
              onClick={() => setRango(rango === r ? null : r)}
              className={cn("min-h-11 rounded-full border-2 px-3 text-sm", rango === r ? "border-[var(--neo-verde-oscuro)] bg-accent font-semibold" : "border-border bg-card")}
            >
              {r}
            </button>
          ))}
        </div>
      </fieldset>
      <Button size="lg" onClick={enviar} disabled={puntaje === null}>
        Enviar opinión
      </Button>
    </div>
  );
}
