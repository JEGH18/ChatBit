"use client";
// Reproduce una conversación grabada con la misma interfaz del asistente (modo demo).
import { useEffect, useMemo, useRef, useState } from "react";
import { estadoInicial } from "@/lib/conversacion/estado";
import type { CanalEntrada, Chip } from "@/lib/conversacion/tipos";
import type { Grabacion } from "@/lib/demo/grabaciones";
import type { ApiAsistente, MensajeUI } from "@/components/asistente/useAsistente";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useReproduccion(grabacion: Grabacion, velocidad: number) {
  const [indice, setIndice] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [estado, setEstado] = useState(() => estadoInicial());
  const [ocupado, setOcupado] = useState(false);
  const [recienLlenados, setRecien] = useState<string[]>([]);
  const [nota, setNota] = useState<string | null>(null);
  const turnoActivo = useRef(0);

  // El componente que usa este hook se monta de nuevo al cambiar de persona (key), así que
  // reiniciar solo hace falta con el botón.
  const reiniciar = () => {
    turnoActivo.current++;
    setIndice(0);
    setMensajes([]);
    setChips([]);
    setEstado(estadoInicial());
    setNota(null);
    setOcupado(false);
  };
  const terminado = indice >= grabacion.pasos.length;
  const activo = reproduciendo && !terminado;

  useEffect(() => {
    if (!activo) return;
    const id = ++turnoActivo.current;
    const vigente = () => id === turnoActivo.current;
    const paso = grabacion.pasos[indice];
    (async () => {
      if (paso.usuario?.texto) {
        setChips([]);
        setNota(paso.usuario.nota ?? null);
        await espera(500 / velocidad);
        if (!vigente()) return;
        setMensajes((ms) => [...ms, { id: `u${indice}`, rol: "usuario", texto: paso.usuario!.texto, canal: paso.usuario!.canal as CanalEntrada }]);
      }
      setOcupado(true);
      await espera(1100 / velocidad);
      if (!vigente()) return;
      setOcupado(false);
      for (const [j, m] of paso.respuesta.mensajes.entries()) {
        setMensajes((ms) => [...ms, { id: `a${indice}-${j}`, rol: "asistente", texto: m.texto, bloque: m.bloque }]);
        if (j === 0) {
          setEstado((antes) => {
            const nuevo = paso.respuesta.estado;
            setRecien(Object.keys(nuevo.valores).filter((k) => JSON.stringify((antes.valores as Record<string, unknown>)[k]) !== JSON.stringify((nuevo.valores as Record<string, unknown>)[k])));
            return nuevo;
          });
        }
        await espera(450 / velocidad);
        if (!vigente()) return;
      }
      setChips(paso.respuesta.chips);
      await espera(1600 / velocidad);
      if (vigente()) setIndice((i) => i + 1);
    })();
  }, [activo, indice, grabacion, velocidad]);

  const sesion: ApiAsistente = useMemo(
    () => ({
      sesionId: "demo",
      estado,
      mensajes,
      chips,
      ocupado,
      modo: grabacion.modo,
      listo: true,
      recienLlenados,
      enviarTexto: () => undefined,
      enviarAccion: async () => undefined,
      reiniciar: () => undefined,
      nota: () => undefined,
    }),
    [estado, mensajes, chips, ocupado, grabacion.modo, recienLlenados],
  );

  return {
    sesion,
    indice,
    total: grabacion.pasos.length,
    reproduciendo: activo,
    nota,
    reproducir: () => setReproduciendo(true),
    pausar: () => {
      turnoActivo.current++;
      setReproduciendo(false);
      setOcupado(false);
    },
    reiniciar: () => {
      setReproduciendo(false);
      reiniciar();
    },
  };
}
