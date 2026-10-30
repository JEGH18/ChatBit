// Departamentos y municipios de Colombia según DIVIPOLA (DANE).
// Fuente de datos: data/divipola.json (se regenera con scripts/datos/importar-divipola.ts).
import datos from "@/data/divipola.json";
import { contieneFrase, normalizar, tipoTitulo } from "@/lib/texto";

export type Departamento = { codigo: string; nombre: string; municipios: [string, string][] };
export type Municipio = { codigo: string; nombre: string; codigoDepartamento: string };

export const DEPARTAMENTOS: Departamento[] = (datos as unknown as { departamentos: Departamento[] }).departamentos;

const POR_CODIGO = new Map(DEPARTAMENTOS.map((d) => [d.codigo, d]));
const MUNICIPIOS: Municipio[] = DEPARTAMENTOS.flatMap((d) =>
  d.municipios.map(([codigo, nombre]) => ({ codigo, nombre, codigoDepartamento: d.codigo })),
);
const MUNICIPIO_POR_CODIGO = new Map(MUNICIPIOS.map((m) => [m.codigo, m]));

/** Nombres cortos para mostrar en botones y en la vista previa. */
const NOMBRE_CORTO: Record<string, string> = {
  "11": "Bogotá D.C.",
  "88": "San Andrés y Providencia",
};

const ALIAS_DEPARTAMENTO: Record<string, string> = {
  valle: "76",
  "valle del cauca": "76",
  bogota: "11",
  "bogota dc": "11",
  "bogota d c": "11",
  "distrito capital": "11",
  guajira: "44",
  "san andres": "88",
  "san andres y providencia": "88",
  "norte de santander": "54",
  "norte santander": "54",
  cundinamarca: "25",
};

/** Ciudades conocidas por un nombre distinto al oficial de DIVIPOLA. */
const ALIAS_MUNICIPIO: Record<string, string> = {
  cali: "76001",
  "santiago de cali": "76001",
  buga: "76111",
  cucuta: "54001",
  cartagena: "13001",
  tolu: "70820",
  tumaco: "52835",
  bogota: "11001",
  "bogota dc": "11001",
  mompox: "13468",
  mompos: "13468",
  "san andres isla": "88001",
};

export const DEPARTAMENTOS_FRECUENTES = ["76", "05", "11", "25", "08", "68"];

export function nombreDepartamento(codigo: string | undefined): string {
  if (!codigo) return "";
  const d = POR_CODIGO.get(codigo);
  return d ? (NOMBRE_CORTO[codigo] ?? tipoTitulo(d.nombre)) : "";
}

export function nombreMunicipio(codigo: string | undefined): string {
  if (!codigo) return "";
  const m = MUNICIPIO_POR_CODIGO.get(codigo);
  if (!m) return "";
  return m.codigo === "11001" ? "BOGOTÁ D.C." : m.nombre;
}

/** Municipio principal (capital) de cada departamento, según el código DIVIPOLA XX001. */
export function municipioPrincipal(codigoDepartamento: string): string | undefined {
  if (codigoDepartamento === "25") return "25754"; // Cundinamarca: su capital es Bogotá; Soacha es el más poblado.
  const codigo = `${codigoDepartamento}001`;
  return MUNICIPIO_POR_CODIGO.has(codigo) ? codigo : undefined;
}

export function existeDepartamento(codigo: string) {
  return POR_CODIGO.has(codigo);
}

export function municipio(codigo: string): Municipio | undefined {
  return MUNICIPIO_POR_CODIGO.get(codigo);
}

export function municipiosDe(codigoDepartamento: string): Municipio[] {
  return MUNICIPIOS.filter((m) => m.codigoDepartamento === codigoDepartamento);
}

/** Busca un departamento mencionado en el texto. Devuelve el código o null. */
export function buscarDepartamento(texto: string): string | null {
  const t = normalizar(texto);
  if (!t) return null;
  if (ALIAS_DEPARTAMENTO[t]) return ALIAS_DEPARTAMENTO[t];
  const exacto = DEPARTAMENTOS.find((d) => normalizar(d.nombre) === t);
  if (exacto) return exacto.codigo;
  // Mención dentro de una frase ("vivo en el valle del cauca"): gana la coincidencia más larga.
  let mejor: { codigo: string; largo: number } | null = null;
  const candidatos: [string, string][] = [
    ...DEPARTAMENTOS.map((d) => [normalizar(d.nombre), d.codigo] as [string, string]),
    ...Object.entries(ALIAS_DEPARTAMENTO),
  ];
  for (const [nombre, codigo] of candidatos) {
    if (contieneFrase(t, nombre) && (!mejor || nombre.length > mejor.largo)) mejor = { codigo, largo: nombre.length };
  }
  if (mejor) return mejor.codigo;
  // Prefijo único ("antio", "cundina")
  if (t.length >= 4) {
    const pref = DEPARTAMENTOS.filter((d) => normalizar(d.nombre).startsWith(t));
    if (pref.length === 1) return pref[0].codigo;
  }
  return null;
}

/**
 * Busca municipios mencionados en el texto. Si se conoce el departamento, restringe a él.
 * Puede devolver varios (p. ej. "La Unión" existe en varios departamentos): en ese caso
 * el asistente debe preguntar, nunca adivinar.
 */
export function buscarMunicipios(texto: string, codigoDepartamento?: string): Municipio[] {
  const t = normalizar(texto);
  if (!t) return [];
  const universo = codigoDepartamento ? municipiosDe(codigoDepartamento) : MUNICIPIOS;

  const porAlias = Object.entries(ALIAS_MUNICIPIO)
    .filter(([alias]) => t === alias || contieneFrase(t, alias))
    .sort((a, b) => b[0].length - a[0].length)
    .map(([, codigo]) => MUNICIPIO_POR_CODIGO.get(codigo)!)
    .filter((m) => !codigoDepartamento || m.codigoDepartamento === codigoDepartamento);

  const exactos = universo.filter((m) => normalizar(m.nombre) === t);
  if (exactos.length) return exactos;
  if (porAlias.length) return [porAlias[0]];

  // Mención dentro de la frase: se queda con las coincidencias más largas.
  const menciones = universo
    .map((m) => ({ m, n: normalizar(m.nombre) }))
    .filter(({ n }) => n.length >= 3 && contieneFrase(t, n));
  if (menciones.length) {
    const largo = Math.max(...menciones.map((x) => x.n.length));
    return menciones.filter((x) => x.n.length === largo).map((x) => x.m);
  }
  if (codigoDepartamento && t.length >= 4) {
    return universo.filter((m) => normalizar(m.nombre).startsWith(t)).slice(0, 6);
  }
  return [];
}

export function etiquetaMunicipioConDepartamento(m: Municipio) {
  return `${tipoTitulo(m.nombre)} (${nombreDepartamento(m.codigoDepartamento)})`;
}
