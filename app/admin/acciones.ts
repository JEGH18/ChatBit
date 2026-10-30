"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { abrirSesionAdmin, cerrarSesionAdmin, claveCorrecta, esAdmin, puedeIntentar } from "@/lib/admin/sesion";
import { repositorio } from "@/lib/datos";
import { generarSintetico } from "@/lib/datos/sintetico";
import { invalidarContexto } from "@/lib/servidor/contexto";

export type EstadoIngreso = { error?: string };

export async function ingresar(_prev: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!puedeIntentar(ip)) return { error: "Demasiados intentos. Espere un minuto." };
  if (!claveCorrecta(String(datos.get("clave") ?? ""))) return { error: "Contraseña incorrecta." };
  await abrirSesionAdmin();
  redirect("/admin");
}

export async function salir() {
  await cerrarSesionAdmin();
  redirect("/admin");
}

async function exigirAdmin() {
  if (!(await esAdmin())) redirect("/admin");
}

export async function aprobarPregunta(datos: FormData) {
  await exigirAdmin();
  const id = Number(datos.get("id"));
  const respuesta = String(datos.get("respuesta") ?? "").trim().slice(0, 1200);
  const pregunta = String(datos.get("pregunta") ?? "").trim().slice(0, 300);
  const palabras = String(datos.get("palabras") ?? "").trim().slice(0, 300);
  if (!id || respuesta.length < 10) return;
  const repo = await repositorio();
  await repo.revisarPregunta(id, { estado: "aprobada", respuesta, preguntaAprobada: pregunta || undefined, palabras });
  invalidarContexto();
  revalidatePath("/admin");
}

export async function descartarPregunta(datos: FormData) {
  await exigirAdmin();
  const id = Number(datos.get("id"));
  if (!id) return;
  const repo = await repositorio();
  await repo.revisarPregunta(id, { estado: "descartada" });
  revalidatePath("/admin");
}

export async function cargarSinteticos() {
  await exigirAdmin();
  const repo = await repositorio();
  await repo.borrarSinteticos();
  const { turnos, encuestas } = generarSintetico(150);
  for (const t of turnos) await repo.guardarTurno(t);
  for (const e of encuestas) await repo.guardarEncuesta(e);
  invalidarContexto();
  revalidatePath("/admin");
}

export async function borrarSinteticos() {
  await exigirAdmin();
  const repo = await repositorio();
  await repo.borrarSinteticos();
  revalidatePath("/admin");
}
