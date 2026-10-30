"use client";
// Pantalla principal: chat a la izquierda y formulario oficial a la derecha (pestañas en celular).
import { useCallback, useState } from "react";
import Link from "next/link";
import { FileText, Headset, MessagesSquare, Moon, MoreHorizontal, PanelRightClose, PanelRightOpen, RotateCcw, Trash2, Type, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CONFIG } from "@/lib/config";
import { progreso } from "@/lib/conversacion/estado";
import type { Accion } from "@/lib/conversacion/tipos";
import type { CampoId } from "@/lib/form/campos";
import { cn } from "@/lib/utils";
import { AvatarNeo } from "./Avatar";
import { Chat } from "./Chat";
import { DialogoRevision } from "./DialogoRevision";
import { EditorCampo } from "./EditorCampo";
import { useAsistente, type ApiAsistente, type OpcionesAsistente } from "./useAsistente";
import { usePreferencias } from "./usePreferencias";
import { useLecturaVoz } from "./voz";
import { VistaFormulario } from "./VistaFormulario";

type Vista = "chat" | "formulario";

/**
 * Un solo control para cambiar de vista: «Chat» (conversación) o «Formulario» (llenarlo uno mismo,
 * a pantalla completa). En escritorio va en el encabezado; en celular, como pestañas.
 */
function SelectorVista({
  vista,
  cambiar,
  completos,
  total,
  pestanas = false,
  className,
}: {
  vista: Vista;
  cambiar: (v: Vista) => void;
  completos: number;
  total: number;
  pestanas?: boolean;
  className?: string;
}) {
  const opciones: { v: Vista; icono: React.ReactNode; etiqueta: string }[] = [
    { v: "chat", icono: <MessagesSquare aria-hidden />, etiqueta: "Chat" },
    { v: "formulario", icono: <FileText aria-hidden />, etiqueta: `Formulario (${completos}/${total})` },
  ];
  if (pestanas) {
    return (
      <div className={cn("flex flex-none border-b border-border", className)} role="tablist" aria-label="Vista">
        {opciones.map((o) => (
          <button
            key={o.v}
            role="tab"
            aria-selected={vista === o.v}
            onClick={() => cambiar(o.v)}
            className={cn("min-h-12 flex-1 border-b-4 font-bold", vista === o.v ? "border-[var(--neo-verde-oscuro)] text-foreground" : "border-transparent text-muted-foreground")}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("items-center rounded-xl border-2 border-primary p-0.5", className)} role="tablist" aria-label="Vista">
      {opciones.map((o) => (
        <button
          key={o.v}
          role="tab"
          aria-selected={vista === o.v}
          onClick={() => cambiar(o.v)}
          className={cn(
            "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors [&_svg]:size-4",
            vista === o.v ? "bg-primary text-primary-foreground" : "text-primary hover:bg-secondary",
          )}
        >
          {o.icono}
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

type Props = {
  /** Permite inyectar una sesión externa (modo demo). */
  sesion?: ApiAsistente;
  opciones?: OpcionesAsistente;
  encabezadoExtra?: React.ReactNode;
};

export function Asistente({ opciones, sesion, encabezadoExtra }: Props) {
  const [pref, setPref] = usePreferencias();
  const lectura = useLecturaVoz(pref.leer);
  // Vista: "chat" (conversación, con la vista previa al lado en escritorio) o "formulario"
  // (el formulario completo para llenarlo uno mismo, sin chat).
  const [vista, setVista] = useState<Vista>("chat");
  const [editando, setEditando] = useState<CampoId | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [opcionesAbiertas, setOpcionesAbiertas] = useState(false);

  const propia = useAsistente({
    ...opciones,
    inactivo: !!sesion,
    alResponder: (textos) => lectura.leer(textos.join(". ")),
    alUi: (ui) => {
      if (ui.abrirFormulario) setVista("formulario");
      if (ui.abrirCampo) setEditando(ui.abrirCampo);
    },
  });
  const a = sesion ?? propia;
  const soloLectura = !!sesion;
  const { completos, total, porcentaje } = progreso(a.estado);
  const formulario = vista === "formulario";
  // Modo solo chat: oculta la vista previa al lado del chat (no aplica a la vista Formulario ni a la demo).
  const soloChat = pref.soloChat && !formulario && !soloLectura;

  const enviarAccion = useCallback(
    (accion: Accion, texto?: string) => {
      if (accion.tipo === "formularioManual") setVista("formulario");
      void a.enviarAccion(accion, texto);
    },
    [a],
  );

  const guardarDesdeFormulario = useCallback(
    async (acciones: { accion: Accion; texto: string }[]) => {
      // En orden: cada acción espera la respuesta de la anterior (p. ej. número y luego confirmación).
      for (const { accion, texto } of acciones) await a.enviarAccion(accion, texto, "formulario");
    },
    [a],
  );

  const alternarSoloChat = () => {
    setPref({ soloChat: !pref.soloChat });
    setVista("chat");
  };

  // Revisión y finalización desde la vista Formulario (el chat no está visible ahí).
  const finalizarDesdeFormulario = async () => {
    await a.enviarAccion({ tipo: "finalizar" }, "Finalizar registro", "formulario");
    setRevisando(false);
    setVista("chat"); // la confirmación, el JSON y la encuesta aparecen en el chat
  };

  const botonSoloChat = (clase?: string) => (
    <Button variant="secondary" size="sm" onClick={alternarSoloChat} aria-pressed={soloChat} className={cn(clase, "aria-pressed:bg-accent aria-pressed:text-accent-foreground")}>
      {soloChat ? <PanelRightOpen aria-hidden /> : <PanelRightClose aria-hidden />} {soloChat ? "Mostrar formulario" : "Solo chat"}
    </Button>
  );

  const pedirAsesor = () => enviarAccion({ tipo: "asesor" }, "Quiero hablar con un asesor");

  const controles = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPref({ texto: pref.texto === "normal" ? "grande" : pref.texto === "grande" ? "muy-grande" : "normal" })}
        title="Cambiar el tamaño del texto"
      >
        <Type aria-hidden /> {pref.texto === "normal" ? "Agrandar texto" : pref.texto === "grande" ? "Texto más grande" : "Texto normal"}
      </Button>
      <Button variant="outline" size="sm" className="aria-pressed:border-[var(--neo-verde-oscuro)] aria-pressed:bg-accent aria-pressed:text-accent-foreground" onClick={() => setPref({ contraste: !pref.contraste })} aria-pressed={pref.contraste}>
        <Moon aria-hidden /> Modo oscuro<span className="sr-only"> de alto contraste</span>
      </Button>
      <Button variant="outline" size="sm" className="aria-pressed:border-[var(--neo-verde-oscuro)] aria-pressed:bg-accent aria-pressed:text-accent-foreground" onClick={() => setPref({ leer: !pref.leer })} aria-pressed={pref.leer}>
        {pref.leer ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />} Leer en voz alta
      </Button>
    </>
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden" data-ocupado={a.ocupado}>
      <header className="flex flex-none items-center gap-3 border-b border-border bg-background px-3 py-2 sm:px-5">
        <AvatarNeo className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight font-extrabold text-primary sm:text-xl">{CONFIG.nombreProducto}</h1>
          <p className="truncate text-sm text-muted-foreground">Registro persona natural · prototipo académico</p>
        </div>
        {encabezadoExtra}
        <div className="hidden items-center gap-2 xl:flex">{controles}</div>
        {!soloLectura && (
          <>
            <Button variant="secondary" size="sm" onClick={pedirAsesor} className="hidden sm:inline-flex">
              <Headset aria-hidden /> Hablar con un asesor
            </Button>
            {!formulario && botonSoloChat("hidden lg:inline-flex")}
            <SelectorVista vista={vista} cambiar={setVista} completos={completos} total={total} className="hidden md:flex" />
          </>
        )}
        <Sheet open={opcionesAbiertas} onOpenChange={setOpcionesAbiertas}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Más opciones">
              <MoreHorizontal />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-80">
            <SheetHeader>
              <SheetTitle>Opciones</SheetTitle>
              <SheetDescription>Accesibilidad, ayuda y privacidad.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-2 px-4 [&>*]:justify-start" onClick={(e) => (e.target as HTMLElement).closest("button,a") && setOpcionesAbiertas(false)}>
              {controles}
              {!soloLectura && (
                <>
                  <Button variant="outline" size="sm" onClick={pedirAsesor}>
                    <Headset aria-hidden /> Hablar con un asesor
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setVista(formulario ? "chat" : "formulario")}>
                    {formulario ? <MessagesSquare aria-hidden /> : <FileText aria-hidden />} {formulario ? "Volver al chat" : "Ver el formulario completo"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={alternarSoloChat} aria-pressed={soloChat} className="hidden md:inline-flex">
                    {soloChat ? <PanelRightOpen aria-hidden /> : <PanelRightClose aria-hidden />} {soloChat ? "Mostrar la vista previa" : "Ocultar la vista previa (solo chat)"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={a.reiniciar}>
                    <RotateCcw aria-hidden /> Empezar de nuevo
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      a.reiniciar();
                      toast.success("Borramos sus datos de este dispositivo.");
                    }}
                  >
                    <Trash2 aria-hidden /> Borrar mis datos de este dispositivo
                  </Button>
                </>
              )}
              <Button variant="link" asChild>
                <Link href="/como-funciona">¿Cómo funciona este asistente?</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <p className="flex-none bg-[var(--neo-morado-claro)] px-3 py-1.5 text-center text-sm text-[var(--neo-morado-oscuro)] sm:px-5" role="note">
        <span className="sm:hidden">
          🤖 Asistente con <strong>IA</strong> · No decide su crédito · Neocrédito <strong>no cobra</strong>.{" "}
        </span>
        <span className="hidden sm:inline">
          🤖 Está hablando con un <strong>asistente de inteligencia artificial</strong>. No decide sobre su crédito. Neocrédito <strong>no cobra</strong> por el trámite y nunca le
          pedirá claves.{" "}
        </span>
        <Link href="/como-funciona" className="font-semibold underline">
          Cómo funciona
        </Link>
        <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs font-semibold" title="Modo de respuesta">
          {a.modo === "ia" ? "Con IA" : a.modo === "local" ? "Sin conexión · modo básico" : "Modo guiado"}
        </span>
      </p>

      {/* Modo solo chat: el avance se ve aquí y la revisión completa llega al final, en el chat. */}
      {soloChat && (
        <div className="hidden flex-none items-center gap-2 border-b border-border bg-muted px-3 py-1 text-sm whitespace-nowrap sm:gap-3 sm:px-5 md:flex" aria-live="polite">
          <span className="font-semibold">Formulario oculto</span>
          <span className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-border sm:w-48" aria-hidden>
            <span className="block h-full rounded-full bg-[var(--neo-verde-oscuro)]" style={{ width: `${porcentaje}%` }} />
          </span>
          <span className="tabular-nums text-muted-foreground">
            {completos}/{total}
            <span className="hidden md:inline"> datos · al final revisará todo antes de enviar</span>
          </span>
          <Button variant="link" size="sm" className="ml-auto px-1" onClick={alternarSoloChat}>
            Mostrar<span className="hidden sm:inline">&nbsp;formulario</span>
          </Button>
        </div>
      )}

      {/* En celular, el mismo selector como pestañas */}
      <SelectorVista vista={vista} cambiar={setVista} completos={completos} total={total} pestanas className="md:hidden" />

      <main
        className={cn(
          "grid min-h-0 flex-1",
          formulario || soloChat ? "grid-cols-1" : "md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]",
        )}
      >
        <section className={cn("min-h-0", formulario && "hidden")} aria-label="Chat con el asistente">
          <Chat
            mensajes={a.mensajes}
            chips={a.chips}
            estado={a.estado}
            sesionId={a.sesionId}
            ocupado={a.ocupado}
            enviarTexto={a.enviarTexto}
            enviarAccion={enviarAccion}
            editarCampo={setEditando}
            leer={lectura.leer}
            soloLectura={soloLectura}
          />
        </section>
        <section className={cn("min-h-0", !formulario && (soloChat ? "hidden" : "hidden md:block"))} aria-label="Formulario de registro">
          <VistaFormulario
            key={vista}
            estado={a.estado}
            manual={formulario}
            recienLlenados={a.recienLlenados}
            editar={soloLectura ? () => undefined : setEditando}
            enviarAccion={enviarAccion}
            alRevisar={() => setRevisando(true)}
            alVolverAlChat={() => setVista("chat")}
            ocupado={a.ocupado || soloLectura}
          />
        </section>
      </main>

      <DialogoRevision
        abierto={revisando}
        estado={a.estado}
        ocupado={a.ocupado}
        alCerrar={() => setRevisando(false)}
        alCorregir={(c) => {
          setRevisando(false);
          setEditando(c);
        }}
        alFinalizar={finalizarDesdeFormulario}
      />
      <EditorCampo campo={editando} estado={a.estado} alCerrar={() => setEditando(null)} alGuardar={guardarDesdeFormulario} />
    </div>
  );
}
