// Extracción de varios campos a partir de un mensaje libre, sin IA (modo guiado y respaldo).
// Es conservadora: solo extrae cuando el contexto es explícito ("me llamo…", "cédula 123…",
// "mi negocio queda en…"). Lo dudoso se deja para que el motor pregunte.
import type { CampoId } from "@/lib/form/campos";
import { CANALES, MEDIOS_CONTACTO, TIPOS_DOCUMENTO } from "@/lib/form/catalogos";
import { existeCiiu } from "@/lib/form/ciiu";
import { interpretarMonto } from "@/lib/form/dinero";
import { buscarDepartamento, buscarMunicipios } from "@/lib/form/divipola";
import { coincidirOpcion, soloDigitos } from "@/lib/form/validadores";
import { normalizar } from "@/lib/texto";

export type Extraccion = {
  /** Valores crudos por campo; el motor los valida con interpretarCampo(). */
  campos: Partial<Record<CampoId, string>>;
  /** Descripción del negocio, para sugerir CIIU cuando llegue ese campo. */
  descripcionActividad?: string;
  /** Monto mencionado con periodo no anual (p. ej. "2 millones al mes"). */
  ventasConPeriodo?: string;
};

const NO_NOMBRE = new Set(
  "de del la el los las un una uno mi su con en por para tengo vivo vendo trabajo estoy quiero soy hago necesito busco microempresario microempresaria comerciante emprendedor emprendedora vendedor vendedora tendero tendera independiente madre padre cabeza hombre mujer senor senora don dona y e que muy bien nuevo nueva".split(
    " ",
  ),
);
const PALABRA_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}$/;

function extraerNombre(original: string): { nombre?: string; apellido?: string } {
  // "me llamo Domiciano Rincón", "mi nombre es Ana María Pérez", "soy Andrés Gómez"
  const m = original.match(
    /\b(?:me llamo|mi nombre es|mi nombre completo es|soy)\s+((?:[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s*){1,4})/i,
  );
  if (!m) return {};
  const explicito = !/^soy$/i.test(m[0].split(/\s+/)[0]);
  const tokens = m[1].split(/\s+/).filter(Boolean);
  const nombre: string[] = [];
  for (const t of tokens) {
    const n = normalizar(t);
    // Se corta en la primera palabra que no es un nombre ("y", "tengo", "vivo"…).
    if (!PALABRA_NOMBRE.test(t) || NO_NOMBRE.has(n)) break;
    // Con "soy" se exige mayúscula inicial ("soy comerciante" no es un nombre).
    if (!explicito && t[0] !== t[0].toUpperCase()) break;
    nombre.push(t);
  }
  if (!nombre.length) return {};
  if (nombre.length === 2) return { nombre: nombre[0], apellido: nombre[1] };
  // Con 3 o más palabras no se adivina cuál es el primer apellido: solo el primer nombre.
  return { nombre: nombre[0] };
}

const RE_CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const RE_CELULAR = /(?:\+?57[\s-]*)?\b3\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/;

function extraerDocumento(original: string, t: string) {
  const m = original.match(
    /\b(c\.?\s?c\.?|c[ée]dula(?: de ciudadan[íi]a| de extranjer[íi]a)?|c\.?\s?e\.?|pasaporte|ppt|permiso por protecci[óo]n temporal|documento|identificaci[óo]n)(?![\wáéíóú])[^\d]{0,25}?([A-Z]{0,2}[\d][\d.\s]{4,16}\d)/i,
  );
  if (!m) return {};
  const etiqueta = normalizar(m[1]);
  let tipo: string | undefined;
  if (/extranjeria|^c e$|^ce$/.test(etiqueta)) tipo = "CE";
  else if (/pasaporte/.test(etiqueta)) tipo = "PA";
  else if (/ppt|permiso/.test(etiqueta)) tipo = "PPT";
  else if (/cedula|^c c$|^cc$/.test(etiqueta)) tipo = "CC";
  else if (/cedula de ciudadania|cedula/.test(t)) tipo = "CC";
  const numero = tipo === "PA" ? m[2].replace(/[\s.]/g, "").toUpperCase() : soloDigitos(m[2]);
  return { tipo, numero };
}

/** Frase que sigue a "vivo en", "mi negocio queda en", "en la ciudad de"… */
function frasesDeLugar(original: string): string[] {
  const res: string[] = [];
  const re =
    /\b(?:vivo en|queda en|est[áa] en|ubicad[oa] en|negocio en|tienda en|local en|trabajo en|ciudad de|municipio de|desde|en el municipio de|en la ciudad de|soy de|en|de)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÜÑáéíóúüñ.]*(?:\s+(?:de|del|la|el|los|las)?\s*[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÜÑáéíóúüñ.]*){0,3})/g;
  for (const m of original.matchAll(re)) res.push(m[1].replace(/[.,;]$/, ""));
  // Departamento después de una coma: "Medellín, Antioquia"
  for (const m of original.matchAll(/,\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+(?:del|de)\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/g)) res.push(m[1]);
  return res;
}

// Frases que introducen la actividad. Los verbos con significado ("arreglo", "vendo", "cultivo")
// se conservan en la descripción: "arreglo celulares" no es lo mismo que "vendo celulares".
const VERBOS_ACTIVIDAD =
  /\b(?:me dedico a|nos dedicamos a|mi negocio es|mi negocio se dedica a|el negocio es|negocio de|tengo|trabajo con|trabajo en)?\s*((?:vendo|vendemos|hago|hacemos|fabrico|fabricamos|arreglo|reparo|preparo|cocino|cultivo|crio|ofrezco|presto servicios? de|un[a]? |una )?[^.;\n]{3,120})/i;
const INICIO_ACTIVIDAD =
  /\b(me dedico a|nos dedicamos a|mi negocio es|mi negocio se dedica a|el negocio es|negocio de|tengo un[a]?|vendo|vendemos|hago|hacemos|fabrico|fabricamos|arreglo|reparo|preparo|cocino|cultivo|crio|ofrezco|presto servicios? de|desarrollo)\b/i;

export function extraerCampos(original: string): Extraccion {
  const t = normalizar(original);
  const campos: Extraccion["campos"] = {};
  const out: Extraccion = { campos };

  const { nombre, apellido } = extraerNombre(original);
  if (nombre) campos.primerNombre = nombre;
  if (apellido) campos.primerApellido = apellido;

  const doc = extraerDocumento(original, t);
  if (doc.tipo) campos.tipoDocumento = doc.tipo;
  if (doc.numero) campos.numeroDocumento = doc.numero;

  const correo = original.match(RE_CORREO)?.[0];
  if (correo) campos.correo = correo;

  const cel = original.replace(correo ?? "", " ").match(RE_CELULAR)?.[0];
  if (cel && soloDigitos(cel).replace(/^57/, "") !== campos.numeroDocumento) campos.celular = cel;

  const genero = t.match(/\b(?:genero|sexo)\s*(?:es\s*)?(masculino|femenino|otro|hombre|mujer)\b/)?.[1] ?? t.match(/\bsoy (hombre|mujer)\b/)?.[1];
  if (genero) campos.genero = genero;

  if (/\b(no tengo|sin) (el )?rut\b|\brut no\b/.test(t)) campos.tieneRut = "No";
  else if (/\b(si )?tengo (el )?rut\b|\bcon rut\b|\brut si\b/.test(t)) campos.tieneRut = "Sí";

  const entero = t.match(/\b(?:me entere|supe|conoci|lo vi|la vi|me llego|llegue)\b[^.]{0,40}?\b(?:por|en|de|a traves de)\s+([a-z ]{3,40})/)?.[1];
  if (entero) {
    const canal = coincidirOpcion(entero.split(" ").slice(0, 4).join(" "), CANALES);
    if (canal) campos.comoSeEntero = canal;
  }

  // Lugar: primero municipios inequívocos, luego departamentos.
  for (const frase of frasesDeLugar(original)) {
    const dep = buscarDepartamento(frase);
    const ms = buscarMunicipios(frase, dep ?? undefined);
    if (ms.length === 1 && !campos.ciudad) {
      campos.ciudad = ms[0].codigo;
      campos.departamento ??= ms[0].codigoDepartamento;
    } else if (dep && normalizar(frase).length <= 25 && !campos.departamento) {
      campos.departamento = dep;
    }
  }

  if (/\b(contact|llam|escrib|prefiero|por favor)/.test(t)) {
    const zona = t.match(/\b(?:contact\w*|llamen|llamar|escriban|prefiero)\b[^.;]{0,40}/)?.[0];
    const medio = zona ? coincidirOpcion(zona, MEDIOS_CONTACTO) : null;
    if (medio) campos.medioContacto = medio;
  }

  if (/\bno (pertenezco|hago parte|soy parte) (a|de) (ninguna )?minoria/.test(t) || /\bninguna minoria\b/.test(t)) {
    campos.perteneceMinoria = "No";
  } else if (/\b(pertenezco|hago parte) (a|de) (una )?minoria\b/.test(t)) {
    campos.perteneceMinoria = "Sí";
  }

  const ciiu = t.match(/\b(?:ciiu|codigo|actividad)\s*(?:es\s*)?(\d{4})\b/)?.[1];
  if (ciiu && existeCiiu(ciiu)) campos.actividadEconomica = ciiu;
  const inicio = original.match(INICIO_ACTIVIDAD);
  if (inicio) {
    const desde = original.slice(inicio.index!).replace(/^(me dedico a|nos dedicamos a|mi negocio es|mi negocio se dedica a|el negocio es|negocio de)\s+/i, "");
    const act = desde.match(VERBOS_ACTIVIDAD)?.[1];
    if (act && !/\brut\b/i.test(act)) out.descripcionActividad = act.replace(/\(.*?\)/g, "").split(/,|;| y mi | y me | y vend| desde hace/)[0].trim();
  }

  const anio = t.match(/\b(?:ventas|vendi|vendimos|facture|ingresos)\b[^.]{0,30}?\b(20\d{2})\b/)?.[1] ?? t.match(/\b(?:en|del|de|ano)\s+(20\d{2})\b[^.]{0,30}\b(?:vendi|ventas|facture)/)?.[1];
  if (anio) campos.anioVentas = anio;

  const zonaVentas = original.match(/\b(?:vend[íi]|vendo|vendemos|vendimos|ventas|facturo|factur[ée]|ingresos)\b[^.;\n]{0,60}/i)?.[0];
  if (zonaVentas) {
    const sinAnio = zonaVentas.replace(/\b20\d{2}\b/g, " ");
    const monto = interpretarMonto(sinAnio);
    if (monto && monto.valor >= 1000) {
      if (monto.periodo && monto.periodo !== "anio") out.ventasConPeriodo = sinAnio;
      else campos.ventasUltimoAnio = String(monto.valor);
    }
  }

  // Tipo de documento suelto: "tengo cédula de extranjería"
  if (!campos.tipoDocumento) {
    const tipo = t.match(/\b(cedula de ciudadania|cedula de extranjeria|pasaporte|ppt)\b/)?.[1];
    if (tipo) campos.tipoDocumento = coincidirOpcion(tipo, TIPOS_DOCUMENTO) ?? undefined;
  }

  return out;
}

export function cantidadExtraida(x: Extraccion) {
  return Object.keys(x.campos).length;
}
