"use client";
// Vista previa en vivo del "Formulario de registro persona natural". Se llena mientras la persona
// conversa; cualquier campo se puede tocar para corregirlo. En la vista "Formulario" (manual) ocupa
// toda la pantalla y funciona como el formulario real, por pasos, con "Anterior", "Siguiente",
// revisión de los datos y "Finalizar registro".
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, HandCoins, MessagesSquare, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { campoActual, listoParaRevision, pasoActual, pasoCompleto, progreso, type EstadoConversacion } from "@/lib/conversacion/estado";
import type { Accion } from "@/lib/conversacion/tipos";
import { CAMPOS, PASOS, type CampoId, type DefinicionCampo, type Paso } from "@/lib/form/campos";
import { valorLegible } from "@/lib/form/presentacion";
import { cn } from "@/lib/utils";

type Props = {
  estado: EstadoConversacion;
  manual: boolean;
  recienLlenados: string[];
  editar: (c: CampoId) => void;
  enviarAccion: (a: Accion, texto?: string) => void;
  /** Vista Formulario: abre la revisión de todos los datos antes de finalizar. */
  alRevisar?: () => void;
  alVolverAlChat?: () => void;
  ocupado: boolean;
};

export function VistaFormulario({ estado, manual, recienLlenados, editar, enviarAccion, alRevisar, alVolverAlChat, ocupado }: Props) {
  const actual = campoActual(estado);
  const { completos, total, porcentaje } = progreso(estado);
  // En la vista Formulario se abre en el paso donde va la persona.
  const [paso, setPaso] = useState<Paso>(() => pasoActual(estado));
  const contenedor = useRef<HTMLDivElement>(null);
  const terminado = estado.fase === "encuesta" || estado.fase === "fin" || estado.fase === "enviado";

  // Sigue al campo que el asistente está preguntando. Se desplaza solo el panel (no la página):
  // scrollIntoView también movía la ventana y dejaba un espacio en blanco debajo.
  useEffect(() => {
    const cont = contenedor.current;
    const el = actual ? cont?.querySelector<HTMLElement>(`[data-campo="${actual}"]`) : null;
    if (!cont || !el) return;
    const arriba = el.offsetTop - cont.scrollTop;
    if (arriba < 0 || arriba + el.offsetHeight > cont.clientHeight) cont.scrollTo({ top: el.offsetTop - cont.clientHeight / 3, behavior: "smooth" });
  }, [actual]);

  const pasosVisibles: Paso[] = manual ? [paso] : [1, 2];

  return (
    <div
      ref={contenedor}
      tabIndex={0}
      role="region"
      className="relative flex h-full flex-col overflow-y-auto bg-[var(--neo-panel-fondo)] text-[var(--neo-panel-texto)] outline-none focus-visible:ring-3 focus-visible:ring-[var(--neo-verde)]"
      aria-label="Vista previa del formulario oficial"
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
        <p id="ayuda-tocar-campo" className="sr-only">
          Toque un campo para llenarlo o corregirlo.
        </p>
        <h2 className="text-center text-xl font-bold sm:text-2xl">
          Formulario de registro <span className="text-[var(--neo-panel-acento)]">persona natural</span>
        </h2>
        <hr className="mt-3 border-[var(--neo-panel-linea)]" />

        <div className="mt-3 flex items-center gap-3" aria-live="polite">
          <Progress value={porcentaje} className="h-2.5 flex-1 bg-[var(--neo-panel-pista)] [&>div]:bg-[var(--neo-verde)]" aria-label="Avance del formulario" />
          <span className="text-sm font-semibold tabular-nums">
            {completos} de {total} campos
          </span>
        </div>

        {manual && !terminado && (
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 text-center text-[0.95rem] text-[var(--neo-panel-suave)]">
            Está llenando el formulario usted mismo: toque cada campo. Lo que ya respondió en el chat sigue aquí.
            {alVolverAlChat && (
              <Button
                variant="ghost"
                size="sm"
                onClick={alVolverAlChat}
                className="text-[var(--neo-panel-texto)] underline hover:bg-[var(--neo-panel-pista)] hover:text-[var(--neo-panel-texto)]"
              >
                <MessagesSquare aria-hidden /> Volver al chat
              </Button>
            )}
          </p>
        )}

        {terminado && estado.radicado && (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-[var(--neo-verde)] p-3 text-[#07332b]">
            <BadgeCheck className="size-6 shrink-0" aria-hidden />
            <div>
              <p className="font-bold">Registro completado (demostración)</p>
              <p className="text-sm">
                Radicado <strong className="tabular-nums">{estado.radicado}</strong>. No se envió nada a Neocrédito.
              </p>
            </div>
          </div>
        )}

        {pasosVisibles.map((p) => (
          <section key={p} className="mt-5" aria-labelledby={`paso-${p}`}>
            <h3 id={`paso-${p}`} className="text-lg font-semibold sm:text-xl">
              {PASOS[p].titulo}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-[var(--neo-panel-suave)]">
              {p === 1 ? <UserRound className="size-4" aria-hidden /> : <HandCoins className="size-4" aria-hidden />}
              {PASOS[p].subtitulo}
              {pasoCompleto(estado, p) && <BadgeCheck className="ml-1 size-4 text-[var(--neo-verde)]" aria-label="paso completo" />}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 2xl:grid-cols-3">
              {CAMPOS.filter((c) => c.paso === p && c.control !== "checkbox").map((c) => (
                <Campo
                  key={c.id}
                  def={c}
                  estado={estado}
                  actual={actual === c.id && !terminado}
                  recien={recienLlenados.includes(c.id)}
                  editar={editar}
                  enviarAccion={enviarAccion}
                  bloqueado={terminado || ocupado}
                  manual={manual}
                />
              ))}
            </div>
            {p === 2 && (
              <div className="mt-4 space-y-2">
                {CAMPOS.filter((c) => c.control === "checkbox").map((c) => (
                  <Consentimiento key={c.id} def={c} estado={estado} actual={actual === c.id && !terminado} editar={editar} bloqueado={terminado || ocupado} />
                ))}
              </div>
            )}
          </section>
        ))}

        {manual && (
          <nav className="mt-6 flex items-center justify-center gap-4" aria-label="Pasos del formulario">
            <Button variant="ghost" className="text-[var(--neo-panel-texto)] underline hover:bg-[var(--neo-panel-pista)] hover:text-[var(--neo-panel-texto)]" disabled={paso === 1} onClick={() => setPaso(1)}>
              <ChevronLeft aria-hidden /> Anterior
            </Button>
            <Button variant="ghost" className="text-[var(--neo-panel-texto)] underline hover:bg-[var(--neo-panel-pista)] hover:text-[var(--neo-panel-texto)]" disabled={paso === 2} onClick={() => setPaso(2)}>
              Siguiente <ChevronRight aria-hidden />
            </Button>
          </nav>
        )}

        {(manual ? paso === 2 : true) && !terminado && (
          <div className="mt-5 flex flex-col items-center gap-1 pb-4">
            <Button
              size="lg"
              disabled={!listoParaRevision(estado) || ocupado}
              onClick={() =>
                manual && alRevisar
                  ? alRevisar()
                  : enviarAccion(estado.fase === "revision" ? { tipo: "finalizar" } : { tipo: "revisar" }, estado.fase === "revision" ? "Finalizar registro" : "Revisar mis datos")
              }
              className="min-w-64 bg-[var(--neo-verde)] text-[#07332b] hover:bg-[var(--neo-verde)]/90"
            >
              {estado.fase === "revision" && !manual ? "Finalizar registro" : "Revisar y finalizar"} <UserRound aria-hidden />
            </Button>
            {!listoParaRevision(estado) && <p className="text-sm text-[var(--neo-panel-suave)]">Se activa cuando estén todos los campos obligatorios.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({
  def,
  estado,
  actual,
  recien,
  editar,
  enviarAccion,
  bloqueado,
  manual,
}: {
  def: DefinicionCampo;
  estado: EstadoConversacion;
  actual: boolean;
  recien: boolean;
  manual: boolean;
  editar: (c: CampoId) => void;
  enviarAccion: (a: Accion, texto?: string) => void;
  bloqueado: boolean;
}) {
  const valor = valorLegible(def.id, estado.valores);
  const omitido = estado.omitidos.includes(def.id);
  const id = `campo-${def.id}`;

  if (def.control === "radio") {
    const actualValor = estado.valores[def.id] as boolean | undefined;
    return (
      <div data-campo={def.id} className={cn("rounded-xl p-1", actual && "ring-3 ring-[var(--neo-verde)]")}>
        <p id={id} className="text-[0.95rem]">
          {def.etiqueta}
        </p>
        <div role="radiogroup" aria-labelledby={id} className="mt-1 flex items-center gap-5">
          {(["Sí", "No"] as const).map((op) => {
            const marcado = actualValor === (op === "Sí");
            return (
              <button
                key={op}
                type="button"
                role="radio"
                aria-checked={marcado}
                disabled={bloqueado}
                onClick={() => enviarAccion({ tipo: "responder", campo: def.id, valor: op }, `Formulario · ${def.etiqueta} ${op}`)}
                className={cn("flex min-h-11 items-center gap-2 rounded-lg px-1", recien && "neo-recien-llenado")}
              >
                <span className="grid size-5 place-items-center rounded-full border-2 border-[var(--neo-campo-borde)] bg-[var(--neo-campo-fondo)]" aria-hidden>
                  {marcado && <span className="size-2.5 rounded-full bg-[var(--neo-marca)]" />}
                </span>
                {op}
              </button>
            );
          })}
          {omitido && <span className="text-sm text-[var(--neo-panel-suave)]">Sin responder</span>}
        </div>
      </div>
    );
  }

  return (
    <div data-campo={def.id}>
      <label htmlFor={id} className="text-[0.95rem]">
        {def.etiqueta}
        {def.obligatorio && (
          <span className="text-[var(--neo-rojo)]" aria-hidden>
            {" "}
            *
          </span>
        )}
        {def.obligatorio && <span className="sr-only"> (obligatorio)</span>}
      </label>
      <button
        id={id}
        type="button"
        disabled={bloqueado}
        onClick={() => editar(def.id)}
        aria-describedby="ayuda-tocar-campo"
        className={cn(
          "mt-1 flex min-h-11 w-full items-center gap-2 rounded-md border-2 border-[var(--neo-campo-borde)] bg-[var(--neo-campo-fondo)] px-3 py-2 text-left text-[0.95rem] text-[var(--neo-campo-texto)] shadow-sm transition-shadow",
          "hover:border-[var(--neo-verde)] focus-visible:border-[var(--neo-verde)] disabled:cursor-default",
          actual && "border-[var(--neo-verde)] ring-3 ring-[var(--neo-verde)]/60",
          recien && "neo-recien-llenado",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !valor && "text-[var(--neo-campo-vacio)]")}>
          {valor || (def.id === "confirmacionDocumento" ? (estado.valores.numeroDocumento ? "Pendiente de confirmar" : "") : omitido ? "Sin responder" : actual ? (manual ? "Toque para llenar" : "Respondiendo en el chat…") : "")}
        </span>
        {def.control === "select" && <ChevronDown className="size-4 shrink-0 text-[var(--neo-campo-texto)]" aria-hidden />}
      </button>
    </div>
  );
}

function Consentimiento({
  def,
  estado,
  actual,
  editar,
  bloqueado,
}: {
  def: DefinicionCampo;
  estado: EstadoConversacion;
  actual: boolean;
  editar: (c: CampoId) => void;
  bloqueado: boolean;
}) {
  const marcado = estado.valores[def.id] === true;
  const [antes, resto] = def.id === "aceptaPoliticaDatos" ? ["Al seleccionar, aceptas nuestra ", "política de tratamiento de datos personales."] : ["Al seleccionar, aceptas nuestros ", "términos y condiciones."];
  return (
    <div data-campo={def.id} className={cn("rounded-lg p-1", actual && "ring-3 ring-[var(--neo-verde)]")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={marcado}
        disabled={bloqueado}
        onClick={() => editar(def.id)}
        className="flex min-h-11 items-center gap-3 text-left text-[0.95rem]"
      >
        <span
          className={cn("grid size-5 shrink-0 place-items-center rounded border-2", marcado ? "border-[var(--neo-marca)] bg-[var(--neo-marca)]" : "border-[var(--neo-campo-borde)] bg-[var(--neo-campo-fondo)]")}
          aria-hidden
        >
          {marcado && (
            <svg viewBox="0 0 16 16" className="size-3.5 text-[var(--neo-marca-texto)]">
              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.2" fill="none" />
            </svg>
          )}
        </span>
        <span>
          {antes}
          <strong className="underline">{resto}</strong>
        </span>
      </button>
    </div>
  );
}
