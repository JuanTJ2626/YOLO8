"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

import { useYoloDetector }  from "@/hooks/useYoloDetector";
import { useVideoSource }   from "@/hooks/useVideoSource";
import { useInferenceLoop } from "@/hooks/useInferenceLoop";
import VideoCanvas          from "@/components/VideoCanvas";
import SidePanel            from "@/components/SidePanel";
import type { Zone }        from "@/lib/types";

/* ── Animated SVG background decoration ── */
function BgDecor() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
      <svg width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0 }}>

        {/* Large outer circle — top right */}
        <g transform="translate(1300, -80)">
          <circle cx="0" cy="0" r="320" fill="none" stroke="#e00000" strokeWidth="0.6" opacity="0.08"
            className="spin-slow" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
          <circle cx="0" cy="0" r="260" fill="none" stroke="#e00000" strokeWidth="0.4" opacity="0.05"
            className="spin-rev" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
          {/* Tick marks */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * 360;
            const rad = (angle * Math.PI) / 180;
            const x1 = Math.cos(rad) * 308;
            const y1 = Math.sin(rad) * 308;
            const x2 = Math.cos(rad) * 320;
            const y2 = Math.sin(rad) * 320;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#e00000" strokeWidth="1" opacity="0.12" />;
          })}
        </g>

        {/* Small circle — bottom left */}
        <g transform="translate(-60, 820)">
          <circle cx="0" cy="0" r="160" fill="none" stroke="#0a0a0a" strokeWidth="0.5" opacity="0.06"
            className="spin-slow" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
          <circle cx="0" cy="0" r="120" fill="none" stroke="#e00000" strokeWidth="0.4" opacity="0.04"
            className="spin-rev" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
        </g>

        {/* Diagonal line grid — subtle */}
        <g opacity="0.03">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i}
              x1={i * 200} y1="0" x2={i * 200 + 900} y2="900"
              stroke="#0a0a0a" strokeWidth="0.8" />
          ))}
        </g>

        {/* Horizontal rule — top */}
        <line x1="0" y1="1" x2="1440" y2="1" stroke="#0a0a0a" strokeWidth="1" opacity="0.06"
          className="dash-draw" strokeDasharray="1440" />

        {/* Floating dot cluster — center right */}
        {[[1100,300],[1130,360],[1160,280],[1080,340],[1150,410]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#e00000" opacity="0.15"
            className="dot-pulse"
            style={{ animationDelay: `${i * 0.4}s`, transformBox: "fill-box", transformOrigin: "center" }} />
        ))}

        {/* Reticle crosshair — decorative, bottom right */}
        <g transform="translate(1380, 780)" opacity="0.1">
          <circle cx="0" cy="0" r="28" fill="none" stroke="#e00000" strokeWidth="1" />
          <circle cx="0" cy="0" r="8"  fill="none" stroke="#e00000" strokeWidth="1" />
          <line x1="-40" y1="0"  x2="-14" y2="0"  stroke="#e00000" strokeWidth="1" />
          <line x1="14"  y1="0"  x2="40"  y2="0"  stroke="#e00000" strokeWidth="1" />
          <line x1="0"  y1="-40" x2="0"  y2="-14" stroke="#e00000" strokeWidth="1" />
          <line x1="0"  y1="14"  x2="0"  y2="40"  stroke="#e00000" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}

const fade  = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

export default function DemoPage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zonesRef  = useRef<Zone[]>([]);
  const draftRef  = useRef<Zone | null>(null);

  const [error,  setError]  = useState("");
  const [aspect, setAspect] = useState(16 / 9);
  const [zones,  setZones]  = useState<Zone[]>([]);

  const { detectorRef, modelStatus, backend, setBackend } = useYoloDetector();

  const { source, startWebcam, onFile, devices, deviceId, setDeviceId } =
    useVideoSource(videoRef, setError);

  const { counts, lights, total, fps, inferMs, commitZones } = useInferenceLoop({
    videoRef, canvasRef, detectorRef, zonesRef, draftRef,
    onError: setError, onResize: setAspect, onUpdate: setBackend,
  });

  const handleCommitZones = (next: Zone[]) => {
    zonesRef.current = next;
    setZones(next);
    commitZones(next);
  };

  return (
    <div className="relative min-h-screen" style={{ background: "var(--bg)" }}>
      <BgDecor />

      <div className="relative z-10 flex flex-col min-h-screen px-6 md:px-10 lg:px-16 py-8">

        {/* ── Header ── */}
        <motion.header
          initial="hidden" animate="show" variants={stagger}
          className="flex items-center justify-between mb-10"
        >
          {/* Wordmark */}
          <motion.div variants={fade} className="flex items-center gap-4">
            {/* SVG logo mark — animated arc */}
            <div className="relative h-10 w-10 flex-shrink-0">
              <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
                <circle cx="20" cy="20" r="18" stroke="#e00000" strokeWidth="1.5" opacity="0.2"
                  className="spin-slow" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                <circle cx="20" cy="20" r="11" stroke="#0a0a0a" strokeWidth="1.5" opacity="0.12"
                  className="spin-rev" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                {/* Center dot */}
                <circle cx="20" cy="20" r="3.5" fill="#e00000"
                  className="dot-pulse" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                {/* Top tick */}
                <line x1="20" y1="2" x2="20" y2="8" stroke="#e00000" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            <div>
              <h1 style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 }}>
                YOLO26n <span className="grad-red">Vision</span>
              </h1>
              <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", color: "var(--ink-3)", marginTop: "4px", textTransform: "uppercase" }}>
                Real-time Object Detection
              </p>
            </div>
          </motion.div>

          {/* Status pills */}
          <motion.div variants={fade} className="flex items-center gap-2">
            {/* Backend pill */}
            <div className="card flex items-center gap-2.5 px-4 py-2" style={{ borderRadius: "100px" }}>
              {/* Animated status dot */}
              <span className="relative flex h-2 w-2 flex-shrink-0">
                {modelStatus === "listo" && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#00c853] opacity-60 animate-ping" />
                )}
                <span className={`relative block h-2 w-2 rounded-full ${
                  modelStatus === "listo"    ? "bg-[#00c853]" :
                  modelStatus === "cargando" ? "bg-[#ffd600]" : "bg-[#e00000]"
                }`} />
              </span>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink-2)" }}>
                {modelStatus === "cargando" ? "Cargando…" : backend || "–"}
              </span>
            </div>

            {/* FPS pill */}
            <div className="card flex items-center gap-2 px-4 py-2" style={{ borderRadius: "100px" }}>
              {/* Animated lightning-like bar */}
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
                <motion.path d="M7 1L1 8h4l-2 5 6-7H5L7 1Z"
                  fill="#e00000"
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </svg>
              <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "monospace", color: "var(--ink)" }}>
                {fps} <span style={{ fontWeight: 300, color: "var(--ink-3)" }}>fps</span>
              </span>
            </div>
          </motion.div>
        </motion.header>

        {/* ── Main grid ── */}
        <motion.main
          initial="hidden" animate="show" variants={stagger}
          className="flex-1 grid gap-6 lg:grid-cols-[1fr_300px] items-start"
        >
          <motion.div variants={fade}>
            <VideoCanvas
              videoRef={videoRef} canvasRef={canvasRef} draftRef={draftRef}
              source={source} modelStatus={modelStatus} aspect={aspect}
              zones={zones} deviceId={deviceId} zonesRef={zonesRef}
              onCommitZones={handleCommitZones}
              onStartWebcam={startWebcam} onFile={onFile}
            />
          </motion.div>

          <motion.div variants={fade} style={{ animationDelay: "0.1s" }}>
            <SidePanel
              source={source} modelStatus={modelStatus} backend={backend}
              devices={devices} deviceId={deviceId}
              zones={zones} counts={counts} lights={lights}
              total={total} fps={fps} inferMs={inferMs} error={error}
              onStartWebcam={startWebcam} onFile={onFile}
              onDeviceChange={(id) => { setDeviceId(id); startWebcam(id); }}
            />
          </motion.div>
        </motion.main>

        {/* ── Footer ── */}
        <motion.footer
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="mt-8 flex items-center justify-between"
          style={{ color: "var(--ink-3)", fontSize: "11px", fontWeight: 500 }}
        >
          <span>YOLO26n · ONNX Web · 320×320</span>
          {/* Animated separator */}
          <svg width="60" height="2" viewBox="0 0 60 2">
            <motion.line x1="0" y1="1" x2="60" y2="1"
              stroke="#e00000" strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.3 }}
              transition={{ duration: 1.2, delay: 0.8 }}
            />
          </svg>
          <span>WebGPU → WebGL → WASM</span>
        </motion.footer>
      </div>
    </div>
  );
}
