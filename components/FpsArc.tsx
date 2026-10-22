"use client";

import { useEffect, useRef } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

const MAX_FPS    = 60;
const HISTORY    = 30;   // bars in the histogram
const R          = 44;   // arc radius
const CX         = 54;
const CY         = 54;
const STROKE     = 6;
const CIRC       = 2 * Math.PI * R;

interface Props {
  fps:     number;
  inferMs: number;
}

export default function FpsArc({ fps, inferMs }: Props) {
  // History buffer for latency bars
  const histRef = useRef<number[]>(Array(HISTORY).fill(0));

  useEffect(() => {
    histRef.current = [...histRef.current.slice(1), inferMs];
  }, [inferMs]);

  // Smooth spring for arc fill
  const springFps = useSpring(fps / MAX_FPS, { stiffness: 60, damping: 18 });
  const dashOffset = useTransform(springFps, (v) => CIRC * (1 - Math.min(v, 1)));

  // Color: green → yellow → red as fps drops
  const arcColor =
    fps >= 25 ? "#00c853" :
    fps >= 12 ? "#ffd600" : "#e00000";

  const hist = histRef.current;
  const maxMs = Math.max(...hist, 1);

  return (
    <div className="flex flex-col gap-3">

      {/* ── Arc + number ── */}
      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0" style={{ width: 108, height: 108 }}>
          <svg width="108" height="108" viewBox="0 0 108 108" fill="none">
            {/* Track */}
            <circle
              cx={CX} cy={CY} r={R}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth={STROKE}
              fill="none"
            />
            {/* Ticks */}
            {Array.from({ length: 12 }).map((_, i) => {
              const a = ((i / 12) * 360 - 90) * (Math.PI / 180);
              const r1 = R + STROKE / 2 + 3;
              const r2 = r1 + (i % 3 === 0 ? 5 : 3);
              return (
                <line key={i}
                  x1={CX + Math.cos(a) * r1} y1={CY + Math.sin(a) * r1}
                  x2={CX + Math.cos(a) * r2} y2={CY + Math.sin(a) * r2}
                  stroke="rgba(0,0,0,0.1)" strokeWidth={i % 3 === 0 ? 1.5 : 0.8}
                />
              );
            })}
            {/* Arc fill — animated */}
            <motion.circle
              cx={CX} cy={CY} r={R}
              stroke={arcColor}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              style={{
                strokeDashoffset: dashOffset,
                rotate: "-90deg",
                transformOrigin: `${CX}px ${CY}px`,
              }}
            />
            {/* Glow dot at arc tip — approximate */}
            <motion.circle
              cx={CX}
              cy={CY - R}
              r={4}
              fill={arcColor}
              style={{
                filter: `drop-shadow(0 0 4px ${arcColor})`,
                transformOrigin: `${CX}px ${CY}px`,
                rotate: useTransform(springFps, (v) => `${Math.min(v, 1) * 360 - 90}deg`),
              }}
            />
          </svg>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              key={fps}
              initial={{ scale: 0.85, opacity: 0.4 }}
              animate={{ scale: 1,    opacity: 1 }}
              className="font-mono"
              style={{ fontSize: "26px", fontWeight: 700, lineHeight: 1, color: "var(--ink)", letterSpacing: "-0.04em" }}
            >
              {fps}
            </motion.span>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              fps
            </span>
          </div>
        </div>

        {/* Stats column */}
        <div className="flex flex-col gap-2 flex-1">
          <div>
            <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: "3px" }}>
              Latencia
            </p>
            <motion.p
              key={inferMs}
              initial={{ y: 4, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="font-mono"
              style={{ fontSize: "22px", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.04em", lineHeight: 1 }}
            >
              {inferMs}
              <span style={{ fontSize: "11px", fontWeight: 400, color: "var(--ink-3)", marginLeft: "3px" }}>ms</span>
            </motion.p>
          </div>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: "3px" }}>
              Backend
            </p>
            <p className="font-mono" style={{ fontSize: "11px", fontWeight: 500, color: "#e00000" }}>
              {fps > 0 ? (
                fps >= 25 ? "Óptimo" : fps >= 12 ? "Moderado" : "Lento"
              ) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Latency histogram ── */}
      <div>
        <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: "8px" }}>
          Historial de latencia
        </p>
        <div className="flex items-end gap-[2px]" style={{ height: "36px" }}>
          {hist.map((ms, i) => {
            const h = maxMs > 0 ? Math.max(2, (ms / maxMs) * 36) : 2;
            const isLast = i === hist.length - 1;
            const barColor = ms === 0 ? "rgba(0,0,0,0.06)" :
              ms < 50  ? "#00c853" :
              ms < 120 ? "#ffd600" : "#e00000";
            return (
              <motion.div
                key={i}
                animate={{ height: h }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex-1 rounded-sm"
                style={{
                  background: barColor,
                  opacity: isLast ? 1 : 0.4 + (i / hist.length) * 0.5,
                  minWidth: "4px",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
