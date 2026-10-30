"use client";
// Pantalla principal: chat a la izquierda y formulario oficial a la derecha (pestañas en celular).
import { useCallback, useState } from "react";
import Link from "next/link";
import { Contrast, FileText, Headset, MessagesSquare, MoreHorizontal, RotateCcw, Trash2, Type, Volume2, VolumeX } from "lucide-react";
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
import { EditorCampo } from "./EditorCampo";
import { useAsistente, type ApiAsistente, type OpcionesAsistente } from "./useAsistente";
import { usePreferencias } from "./usePreferencias";
import { useLecturaVoz } from "./voz";
import { VistaFormulario } from "./VistaFormulario";

type Props = {
  /** Permite inyectar una sesión externa (modo demo). */
  sesion?: ApiAsistente;
  opciones?: OpcionesAsistente;
  encabezadoExtra?: React.ReactNode;
};

export function Asistente({ opciones, sesion, encabezadoExtra }: Props) {
  const [pref, setPref] = usePreferencias();
  const lectura = useLecturaVoz(pref.leer);
  const [manual, setManual] = useState(false);
  const [pestana, setPestana] = useState<"chat" | "formulario">("chat");
  const [editando, setEditando] = useState<CampoId | null>(null);
  const [opcionesAbiertas, setOpcionesAbiertas] = useState(false);

  const propia = useAsistente({
    ...opciones,
    inactivo: !!sesion,
    alResponder: (textos) => lectura.leer(textos.join(". ")),
    alUi: (ui) => {
      if (ui.abrirFormulario) {
        setManual(true);
        setPestana("formulario");
      }
      if (ui.abrirCampo) setEditando(ui.abrirCampo);
    },
  });
  const a = sesion ?? propia;
  const soloLectura = !!sesion;
  const { completos, total } = progreso(a.estado);

  const enviarAccion = useCallback(
    (accion: Accion, texto?: string) => {
      if (accion.tipo === "formularioManual") {
        setManual(true);
        setPestana("formulario");
      }
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

  const alternarManual = () => {
    setManual((m) => !m);
    setPestana(manual ? "chat" : "formulario");
  };

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
      <Button variant="outline" size="sm" onClick={() => setPref({ contraste: !pref.contraste })} aria-pressed={pref.contraste}>
        <Contrast aria-hidden /> Alto contraste
      </Button>
      <Button variant="outline" size="sm" onClick={() => setPref({ leer: !pref.leer })} aria-pressed={pref.leer}>
        {pref.leer ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />} Leer en voz alta
      </Button>
    </>
  );

  return (
    <div className="flex h-dvh flex-col" data-ocupado={a.ocupado}>
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
            <Button variant="secondary" size="sm" onClick={alternarManual} aria-pressed={manual} className="hidden md:inline-flex">
              {manual ? <MessagesSquare aria-hidden /> : <FileText aria-hidden />} {manual ? "Volver al chat" : "Llenar el formulario yo"}
            </Button>
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
                  <Button variant="outline" size="sm" onClick={alternarManual}>
                    <FileText aria-hidden /> {manual ? "Volver al chat" : "Llenar el formulario yo"}
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

      {/* Pestañas en celular */}
      <div className="flex flex-none border-b border-border md:hidden" role="tablist" aria-label="Vista">
        {(["chat", "formulario"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={pestana === t}
            onClick={() => setPestana(t)}
            className={cn("min-h-12 flex-1 border-b-4 font-bold", pestana === t ? "border-[var(--neo-verde-oscuro)] text-foreground" : "border-transparent text-muted-foreground")}
          >
            {t === "chat" ? "Chat" : `Formulario (${completos}/${total})`}
          </button>
        ))}
      </div>

      <main className={cn("grid min-h-0 flex-1", manual ? "md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]" : "md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]")}>
        <section className={cn("min-h-0", pestana !== "chat" && "hidden md:block")} aria-label="Chat con el asistente">
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
        <section className={cn("min-h-0", pestana !== "formulario" && "hidden md:block")} aria-label="Formulario de registro">
          <VistaFormulario
            estado={a.estado}
            manual={manual}
            recienLlenados={a.recienLlenados}
            editar={soloLectura ? () => undefined : setEditando}
            enviarAccion={enviarAccion}
            ocupado={a.ocupado || soloLectura}
          />
        </section>
      </main>

      <EditorCampo campo={editando} estado={a.estado} alCerrar={() => setEditando(null)} alGuardar={guardarDesdeFormulario} />
    </div>
  );
}
