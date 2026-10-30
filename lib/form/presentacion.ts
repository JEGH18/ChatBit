// Cómo se muestran los valores del formulario a la persona (chat, vista previa y resumen).
import { CAMPO, ORDEN, type CampoId } from "./campos";
import { CANALES, GENEROS, MEDIOS_CONTACTO, TIPOS_DOCUMENTO, etiquetaDe } from "./catalogos";
import { etiquetaCiiu } from "./ciiu";
import { nombreDepartamento, nombreMunicipio } from "./divipola";
import type { Valores } from "./validadores";
import { formatoCOP } from "@/lib/texto";

export function valorLegible(campo: CampoId, v: Valores): string {
  const x = v[campo];
  if (x === undefined || x === null) return "";
  switch (campo) {
    case "tipoDocumento":
      return etiquetaDe(TIPOS_DOCUMENTO, v.tipoDocumento);
    case "genero":
      return etiquetaDe(GENEROS, v.genero);
    case "comoSeEntero":
      return etiquetaDe(CANALES, v.comoSeEntero);
    case "medioContacto":
      return etiquetaDe(MEDIOS_CONTACTO, v.medioContacto);
    case "departamento":
      return nombreDepartamento(v.departamento);
    case "ciudad":
      return nombreMunicipio(v.ciudad);
    case "actividadEconomica":
      return etiquetaCiiu(v.actividadEconomica);
    case "ventasUltimoAnio":
      return formatoCOP(v.ventasUltimoAnio!);
    case "tieneRut":
    case "perteneceMinoria":
      return x ? "Sí" : "No";
    case "aceptaPoliticaDatos":
    case "aceptaTerminos":
      return x ? "Aceptado" : "No aceptado";
    default:
      return String(x);
  }
}

/** Filas para la tarjeta de resumen (sin la confirmación del documento ni los consentimientos). */
export function filasResumen(v: Valores, omitidos: CampoId[] = []) {
  return ORDEN.filter((c) => c !== "confirmacionDocumento").map((c) => ({
    campo: c,
    etiqueta: CAMPO[c].etiqueta,
    paso: CAMPO[c].paso,
    valor: valorLegible(c, v) || (omitidos.includes(c) ? "Prefirió no responder" : "Sin responder"),
    completo: v[c] !== undefined,
  }));
}
