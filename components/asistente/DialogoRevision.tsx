"use client";
// Revisión final cuando la persona llena el formulario por su cuenta (vista "Formulario", sin chat):
// muestra todos los datos para verificarlos, permite corregir cualquiera y finalizar.
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EstadoConversacion } from "@/lib/conversacion/estado";
import { PASOS, type CampoId } from "@/lib/form/campos";
import { filasResumen } from "@/lib/form/presentacion";
import { cn } from "@/lib/utils";

type Props = {
  abierto: boolean;
  estado: EstadoConversacion;
  ocupado: boolean;
  alCerrar: () => void;
  alCorregir: (c: CampoId) => void;
  alFinalizar: () => void;
};

export function DialogoRevision({ abierto, estado, ocupado, alCerrar, alCorregir, alFinalizar }: Props) {
  const filas = filasResumen(estado.valores, estado.omitidos);
  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && alCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Revise sus datos antes de finalizar</DialogTitle>
          <DialogDescription>Si algo está mal, toque «Corregir». Al finalizar verá la confirmación y podrá descargar el registro.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-xl border border-border">
          {([1, 2] as const).map((paso) => (
            <section key={paso} aria-labelledby={`revision-paso-${paso}`}>
              <h3 id={`revision-paso-${paso}`} className="bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground">
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
                      <Button variant="ghost" size="sm" onClick={() => alCorregir(f.campo)} aria-label={`Corregir ${f.etiqueta}`}>
                        <Pencil aria-hidden /> Corregir
                      </Button>
                    </div>
                  ))}
              </dl>
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={alCerrar}>
            Seguir editando
          </Button>
          <Button onClick={alFinalizar} disabled={ocupado}>
            Finalizar registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
