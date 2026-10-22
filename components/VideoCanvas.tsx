"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { VideoSource, Zone } from "@/lib/types";

const MAX_ZONES = 4;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface Props {
  videoRef:      React.RefObject<HTMLVideoElement>;
  canvasRef:     React.RefObject<HTMLCanvasElement>;
  draftRef:      React.MutableRefObject<Zone | null>;
  source:        VideoSource;
  modelStatus:   "cargando" | "listo" | "error";
  aspect:        number;
  zones:         Zone[];
  deviceId:      string;
  zonesRef:      React.MutableRefObject<Zone[]>;
  onCommitZones: (zones: Zone[]) => void;
  onStartWebcam: (id?: string) => void;
  onFile:        (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function VideoCanvas({
  videoRef, canvasRef, draftRef,
  source, modelStatus, aspect, zones, deviceId,
  onCommitZones, onStartWebcam, onFile, zonesRef,
}: Props) {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const canDraw = zones.length < MAX_ZONES;

  const toNorm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01((e.clientY - r.top)  / r.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if ((zonesRef.current ?? []).length >= MAX_ZONES) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = toNorm(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = dragStartRef.current;
    if (!s) return;
    const p = toNorm(e);
    draftRef.current = {
      x: Math.min(s.x, p.x), y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y),
    };
  };

  const onPointerUp = () => {
    const z = draftRef.current;
    dragStartRef.current = null;
    draftRef.current = null;
    if (z && z.w > 0.03 && z.h > 0.03)
      onCommitZones([...(zonesRef.current ?? []), z]);
  };

  return (
    <section className="flex flex-col gap-3">

      {/* ── Video wrapper ── */}
      <div className="relative w-full overflow-hidden"
        style={{
          aspectRatio: aspect,
          borderRadius: "20px",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 24px 60px rgba(0,0,0,0.09)",
          background: "#0a0a0a",
        }}
      >
        {/* Red top accent line — animated */}
        <motion.div
          className="absolute inset-x-0 top-0 z-20 pointer-events-none"
          style={{ height: "2px", background: "linear-gradient(90deg, transparent, #e00000 30%, #e00000 70%, transparent)" }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />

        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover z-0"
          style={{ borderRadius: "20px" }}
          autoPlay muted playsInline
          onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
        />

        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full touch-none z-10 ${
            canDraw && source !== "ninguna" ? "cursor-crosshair" : "cursor-default"
          }`}
          style={{ borderRadius: "20px" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />

        {/* Live badge */}
        <AnimatePresence>
          {source !== "ninguna" && modelStatus === "listo" && (
            <motion.div
              key="live"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: "rgba(255,255,255,0.93)", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-[#e00000] opacity-60 animate-ping" />
                <span className="relative block h-2 w-2 rounded-full bg-[#e00000]" />
              </span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#e00000", letterSpacing: "0.1em" }}>LIVE</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Model badge */}
        <AnimatePresence>
          {source !== "ninguna" && modelStatus === "listo" && (
            <motion.div
              key="badge"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: 0.1 }}
              className="absolute top-4 right-4 z-20 pointer-events-none rounded-full px-3 py-1.5"
              style={{ background: "rgba(255,255,255,0.93)", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}
            >
              <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 600, color: "var(--ink-2)" }}>
                YOLO26n · ONNX
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Inactive overlay ── */}
        <AnimatePresence>
          {source === "ninguna" && (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 text-center"
              style={{ background: "rgba(10,10,10,0.91)", borderRadius: "20px" }}
            >
              {/* Animated SVG graphic */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
                className="mb-7"
              >
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                  {/* Outer ring — spinning */}
                  <circle cx="50" cy="50" r="46" stroke="#e00000" strokeWidth="0.8" opacity="0.2"
                    className="spin-slow" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                  {/* Middle ring */}
                  <circle cx="50" cy="50" r="34" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8"
                    className="spin-rev" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                  {/* Tick marks on outer ring */}
                  {Array.from({ length: 16 }).map((_, i) => {
                    const a = (i / 16) * Math.PI * 2;
                    const r1 = 40, r2 = 46;
                    return (
                      <line key={i}
                        x1={50 + Math.cos(a) * r1} y1={50 + Math.sin(a) * r1}
                        x2={50 + Math.cos(a) * r2} y2={50 + Math.sin(a) * r2}
                        stroke="#e00000" strokeWidth={i % 4 === 0 ? 1.5 : 0.7} opacity={i % 4 === 0 ? 0.3 : 0.12}
                      />
                    );
                  })}
                  {/* Camera body */}
                  <motion.rect x="26" y="36" width="36" height="26" rx="4"
                    stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                  {/* Camera lens */}
                  <motion.circle cx="44" cy="49" r="8"
                    stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                  />
                  <circle cx="44" cy="49" r="3.5" fill="#e00000" opacity="0.8"
                    className="dot-pulse" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                  {/* Play triangle */}
                  <motion.path d="M68 42 L80 49 L68 56 Z"
                    stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="none"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.7 }}
                  />
                </svg>
              </motion.div>

              <motion.h3
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.03em", marginBottom: "10px" }}
              >
                Sin fuente de video
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
                style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", maxWidth: "280px", lineHeight: 1.6 }}
              >
                Activa tu cámara o sube un video para iniciar la detección con YOLO26n.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}
                className="flex flex-wrap gap-3 justify-center mt-8"
              >
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => onStartWebcam(deviceId || undefined)}
                  className="shine-btn inline-flex items-center gap-2.5 rounded-2xl px-7 py-3.5 text-sm font-bold text-white"
                  style={{ background: "#e00000", boxShadow: "0 4px 20px rgba(224,0,0,0.35)" }}
                >
                  {/* SVG camera */}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 7 16 12 23 17V7Z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                  </svg>
                  Activar cámara
                </motion.button>

                <motion.label
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2.5 rounded-2xl px-6 py-3.5 text-sm font-semibold cursor-pointer"
                  style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }}
                >
                  {/* SVG upload */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Subir video
                  <input type="file" accept="video/*" onChange={onFile} className="sr-only" />
                </motion.label>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Zone hint bar ── */}
      <div className="flex items-center justify-between px-1">
        <span className="flex items-center gap-2" style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink-3)" }}>
          {/* SVG grid 2x2 */}
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="5" rx="1" stroke="#e00000" strokeWidth="1.2" opacity="0.5"/>
            <rect x="8" y="1" width="5" height="5" rx="1" stroke="#e00000" strokeWidth="1.2" opacity="0.5"/>
            <rect x="1" y="8" width="5" height="5" rx="1" stroke="#e00000" strokeWidth="1.2" opacity="0.5"/>
            <rect x="8" y="8" width="5" height="5" rx="1" stroke="rgba(10,10,10,0.3)" strokeWidth="1.2" opacity="0.5"/>
          </svg>
          {canDraw
            ? `Arrastra para definir zonas · ${zones.length} / ${MAX_ZONES}`
            : "Límite de zonas alcanzado"}
        </span>

        <AnimatePresence>
          {zones.length > 0 && (
            <motion.button
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
              whileHover={{ color: "#e00000" }}
              onClick={() => onCommitZones([])}
              className="flex items-center gap-1.5 transition-colors duration-200"
              style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink-3)" }}
            >
              {/* SVG trash */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
              </svg>
              Limpiar
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
