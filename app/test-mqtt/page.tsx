"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMqttSemaforos } from "@/hooks/useMqttSemaforos";

// ── Tipos ──────────────────────────────────────────────────────────────────
type LightCode = "G" | "Y" | "R";

const LABEL: Record<LightCode, string> = { G: "VERDE", Y: "AMARILLO", R: "ROJO" };
const COLOR: Record<LightCode, string> = { G: "#00c853", Y: "#ffd600", R: "#e00000" };

// ── Preset de prueba ───────────────────────────────────────────────────────
const PRESETS: { label: string; states: LightCode[] }[] = [
  { label: "Zona 1 libre",    states: ["G", "R", "R", "R"] },
  { label: "Zona 2 libre",    states: ["R", "G", "R", "R"] },
  { label: "Zona 3 libre",    states: ["R", "R", "G", "R"] },
  { label: "Zona 4 libre",    states: ["R", "R", "R", "G"] },
  { label: "Zona 1 amarillo", states: ["Y", "R", "R", "R"] },
  { label: "Todo rojo",       states: ["R", "R", "R", "R"] },
];

const ZONE_NAMES = ["Zona 1", "Zona 2", "Zona 3", "Zona 4"];

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
const list = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

// ── Mini semáforo SVG ──────────────────────────────────────────────────────
function MiniLight({ active }: { active: LightCode }) {
  return (
    <svg width="14" height="38" viewBox="0 0 14 38" fill="none">
      <rect x="1" y="1" width="12" height="36" rx="4" stroke="rgba(0,0,0,0.1)" strokeWidth="1"/>
      {(["R","Y","G"] as LightCode[]).map((c, i) => (
        <circle key={c} cx="7" cy={7 + i * 12} r="4"
          fill={active === c ? COLOR[c] : "rgba(0,0,0,0.06)"}
          style={active === c ? {
            filter: `drop-shadow(0 0 3px ${COLOR[c]})`,
          } : {}}
        />
      ))}
    </svg>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function TestMqttPage() {
  const { send, status, error, connected } = useMqttSemaforos();
  const [sent,    setSent]    = useState<LightCode[]>(["R","R","R","R"]);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const handleSend = (states: LightCode[]) => {
    send(states);
    setSent(states);
    setLastMsg(states.join(","));
  };

  // Manual per-zone toggle
  const toggleZone = (i: number) => {
    const cycle: LightCode[] = ["R", "Y", "G"];
    const next = [...sent] as LightCode[];
    next[i] = cycle[(cycle.indexOf(next[i]) + 1) % cycle.length];
    handleSend(next);
  };

  const statusColor =
    status === "conectado"    ? "#00c853" :
    status === "conectando"   ? "#ffd600" :
    status === "error"        ? "#e00000" : "#999";

  return (
    <div className="relative min-h-screen" style={{ background: "var(--bg)" }}>

      {/* Dot-grid from globals.css comes via body::before */}
      <div className="relative z-10 flex flex-col min-h-screen px-6 md:px-10 lg:px-16 py-8">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-10"
        >
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#e00000", boxShadow: "0 4px 14px rgba(224,0,0,0.25)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 2.07 5.18 2 2 0 0 1 4 3h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 10.9a16 16 0 0 0 5.99 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 17Z"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink)" }}>
                Prueba MQTT
              </h1>
              <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: "2px" }}>
                ESP32 · Semáforos
              </p>
            </div>
          </div>

          {/* Connection status */}
          <div className="card flex items-center gap-2.5 px-4 py-2" style={{ borderRadius: "100px" }}>
            <span className="relative flex h-2 w-2 flex-shrink-0">
              {status === "conectado" && (
                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: statusColor, opacity: 0.5 }} />
              )}
              <span className="relative block h-2 w-2 rounded-full" style={{ background: statusColor }} />
            </span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>
              {status}
            </span>
          </div>
        </motion.header>

        {/* ── Main grid ── */}
        <motion.main
          initial="hidden" animate="show" variants={list}
          className="flex-1 grid gap-6 lg:grid-cols-[1fr_280px] items-start"
        >
          {/* Left: presets + manual ── */}
          <div className="flex flex-col gap-5">

            {/* Estado actual */}
            <motion.div variants={item} className="card p-6">
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: "16px" }}>
                Estado actual enviado
              </p>
              <div className="flex gap-4">
                {sent.map((code, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => toggleZone(i)}
                    disabled={!connected}
                    className="flex flex-col items-center gap-2 rounded-2xl px-4 py-4 transition-all cursor-pointer"
                    style={{
                      background: `${COLOR[code]}10`,
                      border: `1px solid ${COLOR[code]}30`,
                      opacity: connected ? 1 : 0.5,
                    }}
                    title="Clic para cambiar"
                  >
                    <MiniLight active={code} />
                    <p style={{ fontSize: "11px", fontWeight: 700, color: COLOR[code], letterSpacing: "0.05em" }}>
                      {ZONE_NAMES[i]}
                    </p>
                    <motion.span
                      key={code}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="rounded-full px-2 py-0.5"
                      style={{
                        fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em",
                        background: `${COLOR[code]}18`,
                        border: `1px solid ${COLOR[code]}40`,
                        color: COLOR[code],
                      }}
                    >
                      {LABEL[code]}
                    </motion.span>
                  </motion.button>
                ))}
              </div>
              <p style={{ fontSize: "11px", color: "var(--ink-3)", marginTop: "12px" }}>
                Toca cualquier semáforo para ciclar R → Y → G
              </p>
            </motion.div>

            {/* Presets */}
            <motion.div variants={item} className="card p-6">
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: "16px" }}>
                Presets de prueba
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {PRESETS.map((preset) => {
                  const isActive = sent.join(",") === preset.states.join(",");
                  return (
                    <motion.button
                      key={preset.label}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => handleSend(preset.states)}
                      disabled={!connected}
                      className="shine-btn rounded-xl px-3 py-3 text-left transition-all"
                      style={{
                        background: isActive ? "#0a0a0a" : "var(--bg-soft, #f5f5f7)",
                        border: isActive ? "1px solid #0a0a0a" : "1px solid var(--border)",
                        color: isActive ? "#fff" : "var(--ink)",
                        opacity: connected ? 1 : 0.4,
                        cursor: connected ? "pointer" : "not-allowed",
                      }}
                    >
                      <p style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                        {preset.label}
                      </p>
                      <div className="flex gap-1">
                        {preset.states.map((c, i) => (
                          <span key={i} className="h-2 w-2 rounded-full inline-block"
                            style={{ background: COLOR[c] }} />
                        ))}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* Right: info panel */}
          <motion.div variants={item} className="flex flex-col gap-4">

            {/* Último mensaje */}
            <div className="card p-5">
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: "12px" }}>
                Último mensaje
              </p>
              <AnimatePresence mode="wait">
                {lastMsg ? (
                  <motion.div key={lastMsg}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  >
                    <p className="font-mono" style={{ fontSize: "22px", fontWeight: 700, color: "var(--ink)", letterSpacing: "0.05em" }}>
                      {lastMsg}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--ink-3)", marginTop: "4px" }}>
                      Topic: <span style={{ fontFamily: "monospace" }}>{process.env.NEXT_PUBLIC_MQTT_TOPIC ?? "semaforos/estado"}</span>
                    </p>
                  </motion.div>
                ) : (
                  <motion.p key="none" style={{ fontSize: "13px", color: "var(--ink-3)" }}>
                    Ninguno todavía
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Instrucciones */}
            <div className="card p-5">
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: "12px" }}>
                Cómo probar
              </p>
              {[
                ["1", "Enciende tu ESP32 con el Monitor Serie abierto (115200)"],
                ["2", "Espera a que el estado diga \"conectado\""],
                ["3", "Pulsa un preset o toca un semáforo para cambiarlo"],
                ["4", "Verifica que en el Monitor Serie aparezca el mensaje"],
                ["5", "El hook reenvía cada 2s — verás el mensaje repetirse"],
              ].map(([n, txt]) => (
                <div key={n} className="flex gap-3 mb-3">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-white"
                    style={{ background: "#e00000", fontSize: "10px", fontWeight: 700 }}>
                    {n}
                  </span>
                  <p style={{ fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.5 }}>{txt}</p>
                </div>
              ))}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-2xl p-4 flex items-start gap-3"
                  style={{ background: "rgba(224,0,0,0.05)", border: "1px solid rgba(224,0,0,0.18)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e00000" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p style={{ fontSize: "12px", color: "#b00000", lineHeight: 1.6 }}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.main>

        {/* ── Footer ── */}
        <motion.footer
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-8 flex items-center justify-between"
          style={{ color: "var(--ink-3)", fontSize: "11px", fontWeight: 500 }}
        >
          <span>MQTT · EMQX · WebSocket</span>
          <span>semaforos/estado</span>
        </motion.footer>
      </div>
    </div>
  );
}
