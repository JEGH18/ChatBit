"use client";
// Edición directa de un campo (al tocarlo en la vista previa o en el modo formulario manual).
// Usa los mismos validadores del servidor; el servidor vuelve a validar al recibir el cambio.
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CONFIG } from "@/lib/config";
import type { EstadoConversacion } from "@/lib/conversacion/estado";
import type { Accion } from "@/lib/conversacion/tipos";
import { CAMPO, type CampoId } from "@/lib/form/campos";
import { CANALES, GENEROS, MEDIOS_CONTACTO, TIPOS_DOCUMENTO, aniosVentas, type Opcion } from "@/lib/form/catalogos";
import { sugerirCiiu, CIIU_FRECUENTES, etiquetaCiiu } from "@/lib/form/ciiu";
import { DEPARTAMENTOS, municipiosDe, nombreDepartamento } from "@/lib/form/divipola";
import { valorLegible } from "@/lib/form/presentacion";
import { interpretarCampo } from "@/lib/form/validadores";
import { normalizar, tipoTitulo } from "@/lib/texto";
import { cn } from "@/lib/utils";

type Props = {
  campo: CampoId | null;
  estado: EstadoConversacion;
  alCerrar: () => void;
  /** Envía una o varias acciones en orden (p. ej. número de documento + confirmación). */
  alGuardar: (acciones: { accion: Accion; texto: string }[]) => void;
};

type Item = { valor: string; etiqueta: string; detalle?: string };

const deOpciones = (ops: readonly Opcion[]): Item[] => ops.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }));

export function EditorCampo({ campo, estado, alCerrar, alGuardar }: Props) {
  return (
    <Dialog open={!!campo} onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {campo && <Contenido key={campo} campo={campo} estado={estado} alCerrar={alCerrar} alGuardar={alGuardar} />}
      </DialogContent>
    </Dialog>
  );
}

function Contenido({ campo, estado, alCerrar, alGuardar }: Props & { campo: CampoId }) {
  const def = CAMPO[campo];
  const v = estado.valores;
  const [texto, setTexto] = useState(() => (campo === "ventasUltimoAnio" && v.ventasUltimoAnio ? v.ventasUltimoAnio.toLocaleString("es-CO") : typeof v[campo] === "string" && def.control !== "select" ? String(v[campo]) : ""));
  const [confirmacion, setConfirmacion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [acepta, setAcepta] = useState(false);

  const lista: Item[] | null = useMemo(() => {
    switch (campo) {
      case "tipoDocumento":
        return deOpciones(TIPOS_DOCUMENTO);
      case "genero":
        return deOpciones(GENEROS);
      case "comoSeEntero":
        return deOpciones(CANALES);
      case "medioContacto":
        return deOpciones(MEDIOS_CONTACTO);
      case "tieneRut":
      case "perteneceMinoria":
        return [
          { valor: "Sí", etiqueta: "Sí" },
          { valor: "No", etiqueta: "No" },
        ];
      case "anioVentas":
        return aniosVentas().map((a) => ({ valor: String(a), etiqueta: String(a) }));
      case "departamento":
        return DEPARTAMENTOS.map((d) => ({ valor: d.codigo, etiqueta: nombreDepartamento(d.codigo) }));
      case "ciudad":
        return v.departamento ? municipiosDe(v.departamento).map((m) => ({ valor: m.codigo, etiqueta: tipoTitulo(m.nombre) })) : [];
      case "actividadEconomica": {
        const q = busqueda.trim();
        if (!q) return CIIU_FRECUENTES.slice(0, 40).map((c) => ({ valor: c.codigo, etiqueta: `${c.codigo} - ${c.corto ?? c.descripcion}`, detalle: c.simple }));
        return sugerirCiiu(q, [], 12).map((c) => ({ valor: c.codigo, etiqueta: `${c.codigo} - ${c.corto}`, detalle: c.simple }));
      }
      default:
        return null;
    }
  }, [campo, busqueda, v.departamento]);

  const conBuscador = campo === "departamento" || campo === "ciudad" || campo === "actividadEconomica";
  const filtrada =
    lista && conBuscador && campo !== "actividadEconomica" && busqueda.trim()
      ? lista.filter((i) => normalizar(i.etiqueta).includes(normalizar(busqueda)))
      : lista;

  const guardarValor = (valor: string, legible?: string) => {
    const r = interpretarCampo(campo, valor, v);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const mostrar = legible ?? (campo === "ventasUltimoAnio" ? `$${Number(r.valor).toLocaleString("es-CO")}` : String(r.valor));
    alGuardar([{ accion: { tipo: "responder", campo, valor }, texto: `Formulario · ${def.etiqueta}: ${mostrar}` }]);
    alCerrar();
  };

  const guardarTexto = () => {
    if (campo === "numeroDocumento") {
      const r = interpretarCampo("numeroDocumento", texto, v);
      if (!r.ok) return setError(r.error);
      if (String(r.valor) !== confirmacion.replace(/[^\dA-Za-z]/g, "").toUpperCase()) return setError("La confirmación no coincide con el número.");
      alGuardar([
        { accion: { tipo: "responder", campo: "numeroDocumento", valor: texto }, texto: `Formulario · Número de documento: ${r.valor}` },
        { accion: { tipo: "confirmarDocumento", correcto: true }, texto: "Formulario · Confirmó el número de documento" },
      ]);
      return alCerrar();
    }
    guardarValor(texto);
  };

  if (campo === "aceptaPoliticaDatos" || campo === "aceptaTerminos") {
    const enlace = campo === "aceptaPoliticaDatos" ? CONFIG.enlaces.politicaDatos : CONFIG.enlaces.terminos;
    return (
      <>
        <DialogHeader>
          <DialogTitle>{campo === "aceptaPoliticaDatos" ? "Política de tratamiento de datos personales" : "Términos y condiciones"}</DialogTitle>
          <DialogDescription>{def.ayuda}</DialogDescription>
        </DialogHeader>
        <a href={enlace} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--neo-verde-oscuro)] underline">
          Leer el texto completo (abre en otra pestaña)
        </a>
        <label className="flex min-h-11 items-start gap-3 rounded-xl border-2 border-border p-3">
          <input type="checkbox" className="mt-1 size-5 accent-[var(--neo-morado)]" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
          <span>{def.etiqueta}</span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={!acepta}
            onClick={() => {
              alGuardar([{ accion: { tipo: "aceptar", campo }, texto: `Formulario · ${def.etiqueta.replace("Al seleccionar, aceptas", "Aceptó")}` }]);
              alCerrar();
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (campo === "ciudad" && !v.departamento) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{def.etiqueta}</DialogTitle>
          <DialogDescription>Primero elija el departamento donde está su negocio.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={alCerrar}>Entendido</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {def.etiqueta}
          {def.obligatorio && <span className="text-destructive"> *</span>}
        </DialogTitle>
        <DialogDescription>{def.ayuda}</DialogDescription>
      </DialogHeader>

      {v[campo] !== undefined && (
        <p className="text-sm">
          Valor actual: <strong>{campo === "actividadEconomica" ? etiquetaCiiu(v.actividadEconomica) : valorLegible(campo, v)}</strong>
        </p>
      )}

      {lista ? (
        <div className="space-y-2">
          {conBuscador && (
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={campo === "actividadEconomica" ? "Describa su negocio: «vendo arepas»" : "Buscar…"}
                aria-label="Buscar"
                className="pl-10"
              />
            </div>
          )}
          <ul className={cn("space-y-1.5", conBuscador && "max-h-[45dvh] overflow-y-auto pr-1")} aria-label="Opciones">
            {filtrada!.map((i) => (
              <li key={i.valor}>
                <button
                  type="button"
                  onClick={() => guardarValor(i.valor, i.etiqueta)}
                  className={cn(
                    "w-full rounded-xl border-2 border-border px-3 py-2.5 text-left hover:border-[var(--neo-verde-oscuro)] hover:bg-accent focus-visible:border-[var(--neo-verde-oscuro)]",
                    String(v[campo]) === i.valor && "border-[var(--neo-verde-oscuro)] bg-accent font-bold",
                  )}
                >
                  {i.etiqueta}
                  {i.detalle && <span className="block text-sm font-normal text-muted-foreground">{i.detalle}</span>}
                </button>
              </li>
            ))}
            {filtrada!.length === 0 && <li className="p-2 text-muted-foreground">Sin resultados.</li>}
          </ul>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            guardarTexto();
          }}
        >
          <Input
            autoFocus
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setError(null);
            }}
            inputMode={campo === "celular" || campo === "numeroDocumento" || campo === "ventasUltimoAnio" ? "numeric" : undefined}
            type={campo === "correo" ? "email" : "text"}
            autoComplete={campo === "correo" ? "email" : campo === "celular" ? "tel" : campo === "primerNombre" ? "given-name" : campo === "primerApellido" ? "family-name" : "off"}
            placeholder={def.ejemplo ? `Ejemplo: ${def.ejemplo}` : undefined}
            aria-label={def.etiqueta}
            aria-invalid={!!error}
            aria-describedby={error ? "error-campo" : undefined}
          />
          {campo === "numeroDocumento" && (
            <label className="block text-sm font-semibold">
              Confirma tu número de documento
              <Input
                value={confirmacion}
                onChange={(e) => {
                  setConfirmacion(e.target.value);
                  setError(null);
                }}
                inputMode="numeric"
                className="mt-1"
                onPaste={(e) => e.preventDefault()}
              />
            </label>
          )}
          {campo === "ventasUltimoAnio" && texto && interpretarCampo("ventasUltimoAnio", texto, v).ok && (
            <p className="text-sm text-muted-foreground">Se guardará como ${Number((interpretarCampo("ventasUltimoAnio", texto, v) as { valor: number }).valor).toLocaleString("es-CO")}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={alCerrar}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      )}

      {error && (
        <p id="error-campo" role="alert" className="font-semibold text-destructive">
          {error}
        </p>
      )}

      {!def.obligatorio && (
        <Button
          variant="ghost"
          onClick={() => {
            alGuardar([{ accion: { tipo: "omitir", campo }, texto: `Formulario · ${def.etiqueta}: prefiero no responder` }]);
            alCerrar();
          }}
        >
          Prefiero no responder
        </Button>
      )}
    </>
  );
}
