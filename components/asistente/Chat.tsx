"use client";
// Conversación: mensajes, botones de respuesta rápida y caja de texto con micrófono.
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Mic, MicOff, SendHorizontal, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EstadoConversacion } from "@/lib/conversacion/estado";
import type { Accion, CanalEntrada, Chip } from "@/lib/conversacion/tipos";
import type { CampoId } from "@/lib/form/campos";
import { campoActual } from "@/lib/conversacion/estado";
import { cn } from "@/lib/utils";
import { AvatarNeo } from "./Avatar";
import { BloqueMensaje } from "./Bloques";
import { Markdown } from "./Markdown";
import type { MensajeUI } from "./useAsistente";
import { useReconocimientoVoz } from "./voz";

type Props = {
  mensajes: MensajeUI[];
  chips: Chip[];
  estado: EstadoConversacion;
  sesionId: string;
  ocupado: boolean;
  enviarTexto: (t: string, canal?: CanalEntrada) => void;
  enviarAccion: (a: Accion, texto?: string) => void;
  editarCampo: (c: CampoId) => void;
  leer: (t: string, forzar?: boolean) => void;
  /** Para el modo demo: deshabilita la escritura. */
  soloLectura?: boolean;
};

export function Chat(p: Props) {
  const lista = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState("");
  const entrada = useRef<HTMLTextAreaElement>(null);
  const voz = useReconocimientoVoz((dicho) => p.enviarTexto(dicho, "voz"));
  const actual = campoActual(p.estado);

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" });
  }, [p.mensajes, p.ocupado, p.chips]);

  const ultimoAsistente = [...p.mensajes].reverse().find((m) => m.rol === "asistente")?.id;
  const numerico = actual === "numeroDocumento" || actual === "celular" || actual === "confirmacionDocumento";

  const enviar = () => {
    if (!texto.trim() || p.ocupado) return;
    p.enviarTexto(texto);
    setTexto("");
    entrada.current?.focus();
  };

  const tocarChip = (c: Chip) => {
    if (c.enlace) return window.open(c.enlace, "_blank", "noopener,noreferrer");
    if (c.accion?.tipo === "abrirCampo") return p.editarCampo(c.accion.campo);
    if (c.accion) return p.enviarAccion(c.accion, c.texto || c.etiqueta);
    p.enviarTexto(c.texto || c.etiqueta, "boton");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div ref={lista} tabIndex={0} className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5" role="log" aria-live="polite" aria-label="Conversación con el asistente">
        <ol className="mx-auto flex max-w-2xl flex-col gap-3">
          {p.mensajes.map((m) =>
            m.rol === "nota" ? (
              <li key={m.id} className="self-center rounded-full bg-muted px-3 py-1 text-center text-sm text-muted-foreground">
                {m.texto}
              </li>
            ) : m.rol === "usuario" ? (
              <li key={m.id} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[var(--neo-burbuja-usuario)] px-4 py-2.5 text-[var(--neo-burbuja-usuario-texto)]">
                <span className="sr-only">Usted dijo: </span>
                {m.canal === "voz" && (
                  <Mic className="mr-1 inline size-4 opacity-80" aria-label="(por voz)" />
                )}
                {m.texto}
              </li>
            ) : (
              <li key={m.id} className="flex max-w-[95%] items-start gap-2 self-start">
                <AvatarNeo className="mt-0.5 size-9 shrink-0" etiqueta={false} />
                <div className="min-w-0 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
                  <span className="sr-only">Neo dijo: </span>
                  {m.texto ? <Markdown texto={m.texto} /> : null}
                  {m.bloque && (
                    <BloqueMensaje
                      bloque={m.bloque}
                      activo={m.id === ultimoAsistente && !p.ocupado && !p.soloLectura}
                      estado={p.estado}
                      sesionId={p.sesionId}
                      enviarAccion={p.enviarAccion}
                      editarCampo={p.editarCampo}
                    />
                  )}
                  {m.texto && (
                    <button
                      type="button"
                      onClick={() => p.leer(m.texto, true)}
                      className="mt-1 -mb-1 inline-flex min-h-8 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      aria-label="Escuchar este mensaje"
                    >
                      <Volume2 className="size-3.5" aria-hidden /> Escuchar
                    </button>
                  )}
                </div>
              </li>
            ),
          )}
          {p.ocupado && (
            <li className="flex items-center gap-2 self-start" aria-label="El asistente está escribiendo">
              <AvatarNeo className="size-9" etiqueta={false} />
              <span className="neo-escribiendo flex gap-1 rounded-2xl border border-border bg-card px-4 py-3" aria-hidden>
                <span className="size-2 rounded-full bg-muted-foreground" />
                <span className="size-2 rounded-full bg-muted-foreground" />
                <span className="size-2 rounded-full bg-muted-foreground" />
              </span>
            </li>
          )}
        </ol>
      </div>

      <div className="border-t border-border bg-background px-3 pt-2 pb-3 sm:px-5">
        {p.chips.length > 0 && !p.soloLectura && (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-2" role="group" aria-label="Respuestas rápidas">
            {p.chips.map((c, i) => (
              <button
                key={`${c.etiqueta}-${i}`}
                type="button"
                disabled={p.ocupado}
                onClick={() => tocarChip(c)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-[0.95rem] font-semibold transition-colors disabled:opacity-50",
                  c.variante === "primario"
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border-primary bg-background text-primary hover:bg-secondary",
                )}
              >
                {c.etiqueta}
                {c.enlace && <ExternalLink className="size-4" aria-label="(abre en otra pestaña)" />}
              </button>
            ))}
          </div>
        )}

        {voz.escuchando && (
          <p className="mx-auto mb-2 max-w-2xl rounded-lg bg-accent px-3 py-2 text-accent-foreground" aria-live="assertive">
            🎙️ Escuchando… {voz.parcial && <span className="font-semibold">«{voz.parcial}»</span>}
          </p>
        )}
        {voz.error && !voz.escuchando && (
          <p className="mx-auto mb-2 max-w-2xl text-sm font-semibold text-destructive" role="alert">
            {voz.error}
          </p>
        )}

        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          {voz.soportado && !p.soloLectura && (
            <Button
              type="button"
              size="icon-lg"
              variant={voz.escuchando ? "destructive" : "outline"}
              onClick={voz.escuchando ? voz.detener : voz.iniciar}
              disabled={p.ocupado}
              aria-label={voz.escuchando ? "Dejar de escuchar" : "Hablar (dictar por voz)"}
              aria-pressed={voz.escuchando}
              className="shrink-0 rounded-full"
            >
              {voz.escuchando ? <MicOff /> : <Mic />}
            </Button>
          )}
          <label htmlFor="mensaje" className="sr-only">
            Escriba su respuesta
          </label>
          <textarea
            id="mensaje"
            ref={entrada}
            rows={1}
            value={texto}
            disabled={p.soloLectura}
            onChange={(e) => setTexto(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            inputMode={numerico ? "numeric" : "text"}
            enterKeyHint="send"
            placeholder={p.soloLectura ? "Modo demostración" : voz.soportado ? "Escriba o toque el micrófono" : "Escriba su respuesta"}
            className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border-2 border-input bg-background px-4 py-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
          <Button type="submit" size="icon-lg" disabled={!texto.trim() || p.ocupado || p.soloLectura} aria-label="Enviar" className="shrink-0 rounded-full">
            <SendHorizontal />
          </Button>
        </form>
      </div>
    </div>
  );
}
