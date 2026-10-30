"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ingresar, type EstadoIngreso } from "@/app/admin/acciones";

export function Ingreso({ configurado }: { configurado: boolean }) {
  const [estado, accion, pendiente] = useActionState<EstadoIngreso, FormData>(ingresar, {});
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-extrabold text-primary">Panel del asistente</h1>
      {!configurado ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          Defina la variable de entorno <code>ADMIN_PASSWORD</code> (y <code>ADMIN_SECRET</code>) para habilitar el panel.
        </p>
      ) : (
        <form action={accion} className="space-y-3">
          <label className="block text-sm font-semibold">
            Contraseña
            <Input name="clave" type="password" autoComplete="current-password" required className="mt-1" />
          </label>
          {estado.error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {estado.error}
            </p>
          )}
          <Button type="submit" disabled={pendiente} className="w-full">
            Ingresar
          </Button>
        </form>
      )}
    </main>
  );
}
