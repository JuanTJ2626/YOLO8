"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { LightState } from "@/lib/trafficController";
import type { ModelStatus, VideoSource, Zone } from "@/lib/types";
import FpsArc from "@/components/FpsArc";

const LIGHT_COLOR: Record<LightState, string> = {
  green:  "#00c853",
  yellow: "#ffd600",
  red:    "#e00000",
};
const LIGHT_LABEL: Record<LightState, string> = {
  green: "VERDE", yellow: "AMARILLO", red: "ROJO",
};
const ZONE_ACCENT = ["#e00000", "#b00000", "#7a0000", "#0a0a0a"];
const MAX_ZONES   = 4;

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
const list = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

interface Props {
  source:         VideoSource;
  modelStatus:    ModelStatus;
  backend:        string;
  devices:        MediaDeviceInfo[];
  deviceId:       string;
  zones:          Zone[];
  counts:         number[];
  lights:         LightState[];
  total:          number;
  fps:            number;
  inferMs:        number;
  error:          string;
  onStartWebcam:  (id?: string) => void;
  onFile:         (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeviceChange: (id: string) => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
      textTransform: "uppercase", color: "var(--ink-3)", marginBottom: "14px",
      fontFamily: "var(--font-sans)",
    }}>
      {children}
    </p>
  );
}

export default function SidePanel({
  source, modelStatus, devices, deviceId,
  zones, counts, lights,
  total, fps, inferMs, error,
  onStartWebcam, onFile, onDeviceChange,
}: Props) {
  return (
    <motion.aside
      initial="hidden" animate="show" variants={list}
      className="flex flex-col gap-4"
    >
      {/* ── Inference progress bar ── */}
      <AnimatePresence>
        {modelStatus === "listo" && fps > 0 && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="relative h-[2px] w-full rounded-full overflow-hidden"
            style={{ background: "rgba(0,0,0,0.06)", transformOrigin: "left" }}
          >
            <div className="absolute inset-y-0 w-1/3 rounded-full infer-bar"
              style={{ background: "linear-gradient(90deg, transparent, #e00000, transparent)" }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Video source ── */}
      <motion.div variants={item} className="card p-5">
        <Label>Fuente de Video</Label>

        {devices.length > 1 && (
          <select
            value={deviceId}
            onChange={(e) => onDeviceChange(e.target.value)}
            className="w-full mb-3 rounded-xl px-3 py-2.5 outline-none"
            style={{
              background: "var(--bg)", border: "1px solid var(--border)",
              fontSize: "12px", fontWeight: 500, color: "var(--ink)",
              fontFamily: "var(--font-sans)",
            }}
          >
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Cámara ${i + 1}`}</option>
            ))}
          </select>
        )}

        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
          onClick={() => onStartWebcam(deviceId || undefined)}
          className="shine-btn w-full rounded-xl py-3 font-bold text-white mb-2.5"
          style={{
            fontSize: "13px",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.01em",
            background: source === "webcam" ? "#0a0a0a" : "#e00000",
            boxShadow: source === "webcam"
              ? "0 2px 12px rgba(0,0,0,0.18)"
              : "0 4px 20px rgba(224,0,0,0.3), 0 1px 3px rgba(224,0,0,0.2)",
          }}
        >
          {source === "webcam" ? "Cámara activa" : "Activar cámara web"}
        </motion.button>

        <motion.label
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold cursor-pointer"
          style={{
            fontSize: "13px",
            background: source === "file" ? "#0a0a0a" : "var(--bg)",
            border: "1px solid var(--border)",
            color: source === "file" ? "#ffffff" : "var(--ink-2)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {source === "file" ? "Video cargado" : "Subir video"}
          <input type="file" accept="video/*" onChange={onFile} className="sr-only" />
        </motion.label>
      </motion.div>

      {/* ── Metrics: objects counter ── */}
      <motion.div variants={item} className="card p-5">
        <Label>Detecciones</Label>

        <div className="flex items-end justify-between gap-4">
          {/* Big number */}
          <div>
            <motion.p
              key={total}
              initial={{ y: 6, opacity: 0.3 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.25 }}
              style={{
                fontSize: "56px", fontWeight: 800, lineHeight: 1,
                letterSpacing: "-0.05em", color: "#e00000",
                fontFamily: "var(--font-display)",
              }}
            >
              {total}
            </motion.p>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-3)", marginTop: "4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Objetos detectados
            </p>
          </div>

          {/* Model status badge */}
          <div className="flex flex-col items-end gap-1.5 pb-1">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              <span className="relative flex h-2 w-2 flex-shrink-0">
                {modelStatus === "listo" && (
                  <span className="absolute inset-0 rounded-full bg-[#00c853] opacity-50 animate-ping" />
                )}
                <span className={`relative block h-2 w-2 rounded-full ${
                  modelStatus === "listo"    ? "bg-[#00c853]" :
                  modelStatus === "cargando" ? "bg-[#ffd600]" : "bg-[#e00000]"
                }`} />
              </span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>
                {modelStatus === "listo" ? "YOLO26n" : modelStatus === "cargando" ? "cargando" : "error"}
              </span>
            </div>
            {/* Zone dots */}
            <div className="flex gap-1">
              {Array.from({ length: MAX_ZONES }).map((_, i) => (
                <motion.div key={i}
                  animate={{ background: i < zones.length ? ZONE_ACCENT[i] : "rgba(0,0,0,0.08)" }}
                  transition={{ duration: 0.4 }}
                  style={{ width: 6, height: 6, borderRadius: "50%" }}
                />
              ))}
            </div>
            <p style={{ fontSize: "10px", color: "var(--ink-3)", fontWeight: 600, letterSpacing: "0.08em" }}>
              {zones.length}/{MAX_ZONES} ZONAS
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── FPS Arc + latency histogram ── */}
      <motion.div variants={item} className="card p-5">
        <Label>Rendimiento</Label>
        <FpsArc fps={fps} inferMs={inferMs} />
      </motion.div>

      {/* ── Traffic lights with full-card glow ── */}
      <motion.div variants={item} className="card p-5" style={{ overflow: "hidden", position: "relative" }}>
        <Label>Semáforos Adaptativos</Label>

        <AnimatePresence mode="wait">
          {zones.length === 0 ? (
            <motion.div key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl p-5 text-center"
              style={{ background: "var(--bg)", border: "1px dashed rgba(0,0,0,0.09)" }}
            >
              <svg width="32" height="48" viewBox="0 0 32 48" fill="none" className="mx-auto mb-3 float">
                <rect x="5" y="2" width="22" height="44" rx="5" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5"/>
                <circle cx="16" cy="12" r="5" fill="rgba(224,0,0,0.15)"/>
                <circle cx="16" cy="24" r="5" fill="rgba(255,214,0,0.15)"/>
                <circle cx="16" cy="36" r="5" fill="rgba(0,200,83,0.15)"/>
              </svg>
              <p style={{ fontSize: "12px", color: "var(--ink-3)", lineHeight: 1.6 }}>
                Dibuja zonas sobre el video para activar el control adaptativo.
              </p>
            </motion.div>
          ) : (
            <motion.div key="zones" className="flex flex-col gap-2.5"
              initial="hidden" animate="show" variants={list}>
              {zones.map((_, i) => {
                const state   = lights[i] ?? "red";
                const color   = LIGHT_COLOR[state];
                const accent  = ZONE_ACCENT[i % ZONE_ACCENT.length];

                return (
                  <motion.div key={i} variants={item}
                    className="relative rounded-2xl px-4 py-3.5 overflow-hidden"
                    style={{ border: `1px solid ${color}25` }}
                    animate={{ background: `${color}08` }}
                    transition={{ duration: 0.5 }}
                  >
                    {/* Full-card ambient glow */}
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: state === "yellow" ? 0.8 : state === "green" ? 1.4 : 2, repeat: Infinity, ease: "easeInOut" }}
                      style={{
                        background: `radial-gradient(ellipse at 50% 120%, ${color}22 0%, transparent 70%)`,
                      }}
                    />

                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Traffic light SVG */}
                        <div className="rounded-xl p-2 flex-shrink-0"
                          style={{ background: "#0a0a0a", boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 4px 12px ${color}30` }}>
                          <svg width="12" height="32" viewBox="0 0 12 32" fill="none">
                            {(["red","yellow","green"] as LightState[]).map((s, si) => (
                              <circle key={s} cx="6" cy={6 + si * 10} r="4"
                                fill={state === s ? LIGHT_COLOR[s] : "rgba(255,255,255,0.08)"}
                                className={state === s
                                  ? s === "green"  ? "light-green"
                                  : s === "yellow" ? "light-yellow" : "light-red"
                                  : ""}
                                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                              />
                            ))}
                          </svg>
                        </div>

                        <div>
                          <p style={{ fontSize: "13px", fontWeight: 700, color: accent, fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
                            Zona {i + 1}
                          </p>
                          <p style={{ fontSize: "11px", color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                            {counts[i] ?? 0} obj
                          </p>
                        </div>
                      </div>

                      {/* State badge */}
                      <motion.div
                        key={state}
                        initial={{ scale: 0.75, opacity: 0 }}
                        animate={{ scale: 1,    opacity: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="rounded-full px-3 py-1"
                        style={{
                          fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em",
                          background: `${color}18`,
                          border: `1px solid ${color}45`,
                          color,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {LIGHT_LABEL[state]}
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: "rgba(224,0,0,0.05)", border: "1px solid rgba(224,0,0,0.18)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e00000" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style={{ fontSize: "12px", color: "#b00000", lineHeight: 1.6 }}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
