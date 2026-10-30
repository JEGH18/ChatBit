"use client";
// Estado de la sesión en el navegador: conversación, formulario y conexión con /api/chat.
// Los datos personales viven solo aquí (localStorage, máximo 24 horas). Si la red falla,
// el mismo motor determinista corre en el navegador para que la persona no pierda el avance.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CONFIG } from "@/lib/config";
import { estadoInicial, sanitizarEstado, type EstadoConversacion } from "@/lib/conversacion/estado";
import { procesarTurno } from "@/lib/conversacion/motor";
import type { Accion, Bloque, CanalEntrada, Chip, Entrada, Turno } from "@/lib/conversacion/tipos";
import { leerFlujo } from "./flujo-cliente";

export type MensajeUI = {
  id: string;
  rol: "asistente" | "usuario" | "nota";
  texto: string;
  bloque?: Bloque;
  canal?: CanalEntrada;
};

export type Modo = "ia" | "guiado" | "local";

type Guardado = {
  version: 1;
  sesionId: string;
  estado: EstadoConversacion;
  mensajes: MensajeUI[];
  chips: Chip[];
  guardadoEn: number;
};

const CLAVE = "asistente-neo:sesion:v1";
const nuevoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function cargar(): Guardado | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const g = JSON.parse(crudo) as Guardado;
    if (g.version !== 1 || Date.now() - g.guardadoEn > CONFIG.horasRetencionLocal * 3600_000) {
      localStorage.removeItem(CLAVE);
      return null;
    }
    return { ...g, estado: sanitizarEstado(g.estado) };
  } catch {
    return null;
  }
}

export type OpcionesAsistente = {
  /** Fuerza el modo guiado (sin IA). Útil en pruebas E2E. */
  forzarGuiado?: boolean;
  /** No persiste en localStorage. */
  efimero?: boolean;
  /** No arranca ninguna sesión (la conversación la maneja otro componente, p. ej. el modo demo). */
  inactivo?: boolean;
  alResponder?: (textos: string[]) => void;
  alUi?: (ui: NonNullable<Turno["ui"]>) => void;
};

export function useAsistente(opciones: OpcionesAsistente = {}) {
  const [sesionId, setSesionId] = useState<string>("");
  const [estado, setEstado] = useState<EstadoConversacion>(() => estadoInicial());
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [modo, setModo] = useState<Modo>("guiado");
  const [listo, setListo] = useState(false);
  const [recienLlenados, setRecienLlenados] = useState<string[]>([]);
  const estadoRef = useRef(estado);
  const mensajesRef = useRef(mensajes);
  const ocupadoRef = useRef(false);
  const opts = useRef(opciones);
  useLayoutEffect(() => {
    opts.current = opciones;
    mensajesRef.current = mensajes;
  });

  // Persistencia local (se puede retomar si se cierra la pestaña).
  useEffect(() => {
    if (!listo || opts.current.efimero || !sesionId) return;
    const g: Guardado = { version: 1, sesionId, estado, mensajes: mensajes.slice(-120), chips, guardadoEn: Date.now() };
    try {
      localStorage.setItem(CLAVE, JSON.stringify(g));
    } catch {
      /* almacenamiento lleno o bloqueado: se sigue sin persistir */
    }
  }, [estado, mensajes, chips, sesionId, listo]);

  const aplicarEstado = useCallback((nuevo: EstadoConversacion) => {
    const antes = estadoRef.current.valores as Record<string, unknown>;
    const cambiados = Object.entries(nuevo.valores)
      .filter(([k, v]) => JSON.stringify(antes[k]) !== JSON.stringify(v))
      .map(([k]) => k);
    if (cambiados.length) {
      setRecienLlenados(cambiados);
      setTimeout(() => setRecienLlenados([]), 1600);
    }
    estadoRef.current = nuevo;
    setEstado(nuevo);
  }, []);

  /** Turno resuelto en el navegador con el motor local (sin conexión). */
  const turnoLocal = useCallback(
    (entrada: Entrada) => {
      const turno = procesarTurno(estadoRef.current, entrada);
      const nuevos: MensajeUI[] = turno.mensajes.map((m) => ({ id: nuevoId(), rol: "asistente", texto: m.texto, bloque: m.bloque }));
      setMensajes((ms) => [...ms, ...nuevos]);
      setChips(turno.chips);
      aplicarEstado(turno.estado);
      if (turno.ui) opts.current.alUi?.(turno.ui);
      opts.current.alResponder?.(nuevos.map((m) => m.texto));
      setModo("local");
    },
    [aplicarEstado],
  );

  const enviar = useCallback(
    async (entrada: Entrada, textoVisible?: string, sesion = sesionId) => {
      if (ocupadoRef.current) return;
      const visible = textoVisible ?? entrada.texto;
      if (visible?.trim() && entrada.accion?.tipo !== "iniciar") {
        setMensajes((ms) => [...ms, { id: nuevoId(), rol: entrada.canal === "formulario" ? "nota" : "usuario", texto: visible.trim(), canal: entrada.canal }]);
      }
      ocupadoRef.current = true;
      setOcupado(true);
      setChips([]);
      const historial = mensajesRef.current
        .filter((m) => m.rol !== "nota" && m.texto)
        .slice(-12)
        .map((m) => ({ rol: m.rol as "usuario" | "asistente", texto: m.texto.slice(0, 2000) }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sesionId: sesion,
            estado: estadoRef.current,
            entrada,
            historial,
            modo: opts.current.forzarGuiado ? "guiado" : "auto",
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const ids = new Map<string, string>();
        const textos: string[] = [];
        let recibioEstado = false;
        for await (const ev of leerFlujo(res)) {
          if (ev.tipo === "texto-inicio") {
            const id = nuevoId();
            ids.set(ev.id, id);
            textos.push("");
            setMensajes((ms) => [...ms, { id, rol: "asistente", texto: "" }]);
          } else if (ev.tipo === "texto") {
            const id = ids.get(ev.id);
            textos[textos.length - 1] += ev.delta;
            setMensajes((ms) => ms.map((m) => (m.id === id ? { ...m, texto: m.texto + ev.delta } : m)));
          } else if (ev.tipo === "bloque") {
            setMensajes((ms) => {
              const ultimo = ms.at(-1);
              if (ultimo?.rol === "asistente" && !ultimo.bloque) return [...ms.slice(0, -1), { ...ultimo, bloque: ev.bloque }];
              return [...ms, { id: nuevoId(), rol: "asistente", texto: "", bloque: ev.bloque }];
            });
          } else if (ev.tipo === "estado") {
            recibioEstado = true;
            aplicarEstado(ev.datos.estado);
            setChips(ev.datos.chips);
            setModo(ev.datos.modo);
            if (ev.datos.ui) opts.current.alUi?.(ev.datos.ui);
          } else if (ev.tipo === "error") {
            throw new Error(ev.mensaje);
          }
        }
        // Quita burbujas vacías (p. ej. pasos de herramientas sin texto).
        setMensajes((ms) => ms.filter((m) => m.texto.trim() || m.bloque || m.rol !== "asistente"));
        if (!recibioEstado) throw new Error("Respuesta incompleta");
        opts.current.alResponder?.(textos.filter(Boolean));
      } catch {
        // Sin conexión o error del servidor: el motor local continúa la conversación.
        turnoLocal(entrada);
      } finally {
        ocupadoRef.current = false;
        setOcupado(false);
      }
    },
    [sesionId, aplicarEstado, turnoLocal],
  );

  const iniciar = useCallback(
    (id: string) => {
      setMensajes([]);
      setChips([]);
      const inicial = estadoInicial();
      estadoRef.current = inicial;
      setEstado(inicial);
      setListo(true);
      void enviar({ accion: { tipo: "iniciar" } }, undefined, id);
    },
    [enviar],
  );

  // Arranque: retoma la sesión guardada o empieza una nueva.
  useEffect(() => {
    if (opts.current.inactivo) return;
    const g = opts.current.efimero ? null : cargar();
    if (g) {
      setSesionId(g.sesionId);
      estadoRef.current = g.estado;
      setEstado(g.estado);
      setMensajes([...g.mensajes, { id: nuevoId(), rol: "nota", texto: "Retomamos donde iba. Sus datos siguen guardados en este dispositivo." }]);
      setChips(g.chips);
      setListo(true);
    } else {
      const id = nuevoId();
      setSesionId(id);
      iniciar(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reiniciar = useCallback(() => {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* nada */
    }
    const id = nuevoId();
    setSesionId(id);
    iniciar(id);
  }, [iniciar]);

  const enviarTexto = useCallback(
    (texto: string, canal: CanalEntrada = "texto") => {
      const t = texto.trim();
      if (t) void enviar({ texto: t, canal });
    },
    [enviar],
  );

  const enviarAccion = useCallback(
    (accion: Accion, textoVisible?: string, canal: CanalEntrada = "boton") => enviar({ accion, texto: textoVisible, canal }, textoVisible),
    [enviar],
  );

  /** Agrega una nota local al chat (p. ej. cambios hechos en el formulario). */
  const nota = useCallback((texto: string) => {
    setMensajes((ms) => [...ms, { id: nuevoId(), rol: "nota", texto }]);
  }, []);

  return {
    sesionId,
    estado,
    mensajes,
    chips,
    ocupado,
    modo,
    listo,
    recienLlenados,
    enviarTexto,
    enviarAccion,
    reiniciar,
    nota,
  };
}

export type ApiAsistente = ReturnType<typeof useAsistente>;
