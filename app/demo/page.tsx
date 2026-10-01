"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { YoloDetector, COCO_CLASSES, type Detection } from "@/lib/yolo";
import { TrafficController, type LightState } from "@/lib/trafficController";
import {
  Camera, Upload, RefreshCw, Trash2, ShieldAlert, Cpu,
  Layers, Activity, CheckCircle2, Video, Zap,
} from "lucide-react";

const MODEL_URL = "/models/yolov8n_webgpu.onnx";
const MAX_ZONES = 4;

type Zone = { x: number; y: number; w: number; h: number };

const LIGHT_COLOR: Record<LightState, string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
};

const ZONE_COLORS = [
  { border: "#3b82f6", bg: "rgba(59, 130, 246, 0.18)", text: "#60a5fa" },
  { border: "#10b981", bg: "rgba(16, 185, 129, 0.18)", text: "#34d399" },
  { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.18)", text: "#fbbf24" },
  { border: "#a855f7", bg: "rgba(168, 85, 247, 0.18)", text: "#c084fc" },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function DemoPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<YoloDetector | null>(null);
  const controllerRef = useRef(new TrafficController(0));
  const zonesRef = useRef<Zone[]>([]);
  const detsRef = useRef<Detection[]>([]);
  const lightsRef = useRef<LightState[]>([]);
  const draftRef = useRef<Zone | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);

  const [modelStatus, setModelStatus] = useState<"cargando" | "listo" | "error">("cargando");
  const [backend, setBackend] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] = useState<"ninguna" | "webcam" | "file">("ninguna");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [aspect, setAspect] = useState(16 / 9);
  const [zones, setZones] = useState<Zone[]>([]);
  const [counts, setCounts] = useState<number[]>([]);
  const [lights, setLights] = useState<LightState[]>([]);
  const [total, setTotal] = useState(0);
  const [fps, setFps] = useState(0);
  const [inferMs, setInferMs] = useState<number>(0);

  // ---------- Fuente de video ----------
  const stopSource = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
      v.removeAttribute("src");
      v.load();
    }
    detsRef.current = [];
  }, []);

  const startWebcam = async (id?: string) => {
    try {
      setError("");
      stopSource();
      const constraints: MediaStreamConstraints = {
        video: id
          ? { deviceId: { exact: id } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      v.loop = false;
      v.muted = true;
      v.playsInline = true;
      await v.play().catch(() => {});
      setSource("webcam");

      const list = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "videoinput"
      );
      setDevices(list);
      const active = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (active) setDeviceId(active);
    } catch (e) {
      setError(
        "No se pudo acceder a la cámara. Verifica los permisos en tu navegador: " +
          (e instanceof Error ? e.message : String(e))
      );
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    stopSource();
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    const v = videoRef.current!;
    v.src = url;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    await v.play().catch(() => {});
    setSource("file");
    e.target.value = "";
  };

  // ---------- Zonas ----------
  const commitZones = useCallback((next: Zone[]) => {
    zonesRef.current = next;
    controllerRef.current = new TrafficController(next.length);
    lightsRef.current = next.map(() => "red");
    setZones(next);
    setCounts(next.map(() => 0));
    setLights(next.map(() => "red"));
  }, []);

  const toNorm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (zonesRef.current.length >= MAX_ZONES) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = toNorm(e);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = dragStartRef.current;
    if (!s) return;
    const p = toNorm(e);
    draftRef.current = {
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    };
  };
  const onPointerUp = () => {
    const z = draftRef.current;
    dragStartRef.current = null;
    draftRef.current = null;
    if (z && z.w > 0.03 && z.h > 0.03) commitZones([...zonesRef.current, z]);
  };

  // ---------- Carga del modelo REAL ----------
  useEffect(() => {
    let cancelled = false;
    setModelStatus("cargando");

    YoloDetector.create(MODEL_URL)
      .then((d) => {
        if (cancelled) { d.dispose(); return; }
        detectorRef.current = d;
        setBackend(d.backend);
        setModelStatus("listo");
      })
      .catch((e) => {
        console.error("[YOLO] Error al cargar el modelo:", e);
        if (!cancelled) {
          setModelStatus("error");
          setError("Error al cargar el modelo ONNX: " + (e instanceof Error ? e.message : String(e)));
        }
      });

    return () => {
      cancelled = true;
      detectorRef.current?.dispose();
      detectorRef.current = null;
      stopSource();
    };
  }, [stopSource]);

  // Las zonas se crean manualmente arrastrando sobre el video (no se crean automáticamente)

  // ---------- Loop principal de inferencia y render ----------
  useEffect(() => {
    let busy = false;
    let disabled = false;
    let lastDone = 0;
    let fpsAvg = 0;
    let lastUIUpdate = 0;

    const runInference = (video: HTMLVideoElement, det: YoloDetector) => {
      busy = true;
      const tStart = performance.now();
      det
        .detect(video)
        .then((dets) => {
          const lat = Math.round(performance.now() - tStart);
          detsRef.current = dets;
          const vw = video.videoWidth || 1280;
          const vh = video.videoHeight || 720;
          const zs = zonesRef.current;
          const c = zs.map(() => 0);
          for (const d of dets) {
            const cx = (d.x1 + d.x2) / 2 / vw;
            const cy = (d.y1 + d.y2) / 2 / vh;
            zs.forEach((z, i) => {
              if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) c[i]++;
            });
          }
          const states = controllerRef.current.update(c, performance.now());
          lightsRef.current = states;

          const now = performance.now();
          const dt = now - lastDone;
          lastDone = now;
          if (dt > 0 && dt < 2000) fpsAvg = fpsAvg === 0 ? 1000 / dt : fpsAvg * 0.8 + (1000 / dt) * 0.2;

          if (now - lastUIUpdate > 200) {
            lastUIUpdate = now;
            setBackend(det.backend);
            setCounts(c);
            setLights(states);
            setTotal(dets.length);
            setFps(Math.round(fpsAvg));
            setInferMs(lat);
          }
        })
        .catch((e) => {
          console.error(e);
          disabled = true;
          setError("Falló la inferencia: " + (e instanceof Error ? e.message : String(e)));
        })
        .finally(() => { busy = false; });
    };

    const draw = (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const u = Math.max(1, W / 640);
      ctx.clearRect(0, 0, W, H);
      ctx.font = `600 ${Math.round(13 * u)}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = "top";

      // Zonas y semáforos
      zonesRef.current.forEach((z, i) => {
        const lightState = lightsRef.current[i] ?? "red";
        const theme = ZONE_COLORS[i % ZONE_COLORS.length];

        ctx.fillStyle = theme.bg;
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 3 * u;
        ctx.fillRect(z.x * W, z.y * H, z.w * W, z.h * H);
        ctx.strokeRect(z.x * W, z.y * H, z.w * W, z.h * H);

        const labelText = `Zona ${i + 1} (${counts[i] ?? 0} veh)`;
        const tw = ctx.measureText(labelText).width + 12 * u;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(z.x * W, z.y * H, tw, 24 * u);
        ctx.fillStyle = theme.text;
        ctx.fillText(labelText, z.x * W + 6 * u, z.y * H + 4 * u);

        const boxX = z.x * W + z.w * W - 28 * u;
        const boxY = z.y * H + 6 * u;
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.roundRect ? ctx.roundRect(boxX, boxY, 22 * u, 54 * u, 6 * u) : ctx.fillRect(boxX, boxY, 22 * u, 54 * u);
        ctx.fill();

        const states: LightState[] = ["red", "yellow", "green"];
        states.forEach((st, idx) => {
          const cy = boxY + 9 * u + idx * 17 * u;
          const cx = boxX + 11 * u;
          ctx.beginPath();
          ctx.arc(cx, cy, 5.5 * u, 0, Math.PI * 2);
          if (lightState === st) {
            ctx.fillStyle = LIGHT_COLOR[st];
            ctx.shadowColor = LIGHT_COLOR[st];
            ctx.shadowBlur = 10 * u;
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.15)";
            ctx.shadowBlur = 0;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      });

      // Zona borrador
      const draft = draftRef.current;
      if (draft) {
        ctx.strokeStyle = "#38bdf8";
        ctx.setLineDash([6 * u, 4 * u]);
        ctx.lineWidth = 2 * u;
        ctx.strokeRect(draft.x * W, draft.y * H, draft.w * W, draft.h * H);
        ctx.setLineDash([]);
      }

      // Bounding Boxes REALES (Detecta todos los objetos COCO)
      ctx.lineWidth = 2 * u;
      for (const d of detsRef.current) {
        const labelName = COCO_CLASSES[d.classId] ?? `Objeto ${d.classId}`;
        ctx.strokeStyle = "#22d3ee";
        ctx.strokeRect(d.x1, d.y1, d.x2 - d.x1, d.y2 - d.y1);

        const label = `${labelName} ${Math.round(d.score * 100)}%`;
        const tw = ctx.measureText(label).width + 10 * u;
        const th = 20 * u;
        const ty = Math.max(0, d.y1 - th);
        ctx.fillStyle = "#0891b2";
        ctx.fillRect(d.x1, ty, tw, th);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, d.x1 + 5 * u, ty + 3 * u);
      }
    };

    // ── Inferencia: usa setInterval, NUNCA toca requestAnimationFrame ──
    // Así el hilo principal del navegador siempre es libre para el dibujo
    const inferInterval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
        setAspect(vw / vh);
      }

      const det = detectorRef.current;
      if (det && !busy && !disabled) {
        runInference(video, det);
      }
    }, 0); // 0ms = lo más seguido posible sin bloquear

    // ── Dibujo: RAF limpio, solo pinta en canvas, nada de inferencia ──
    let drawRaf = 0;
    const drawLoop = () => {
      drawRaf = requestAnimationFrame(drawLoop);
      const canvas = canvasRef.current;
      if (canvas) draw(canvas);
    };
    drawRaf = requestAnimationFrame(drawLoop);

    return () => {
      clearInterval(inferInterval);
      cancelAnimationFrame(drawRaf);
    };
  }, []);

  const canDraw = zones.length < MAX_ZONES;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="h-6 w-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                Detección Inteligente de Objetos YOLO
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Detección Multiclase (Personas, Vehículos, Celulares, Animales) con ONNX Web
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              modelStatus === "listo"
                ? "bg-emerald-950/80 border-emerald-700 text-emerald-300"
                : modelStatus === "cargando"
                ? "bg-blue-950/80 border-blue-700 text-blue-300 animate-pulse"
                : "bg-rose-950/80 border-rose-700 text-rose-300"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            {modelStatus === "cargando" ? "Cargando modelo…" : `Backend: `}
            {modelStatus !== "cargando" && <span className="font-mono">{backend || "–"}</span>}
          </span>

          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            {fps} FPS
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Video + Canvas */}
        <section className="flex flex-col gap-3">
          <div
            className="relative w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl"
            style={{ aspectRatio: aspect }}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover rounded-2xl z-0"
              autoPlay
              muted
              playsInline
              onLoadedMetadata={() => { videoRef.current?.play().catch(() => {}); }}
            />

            <canvas
              ref={canvasRef}
              className={`absolute inset-0 h-full w-full touch-none z-10 ${
                canDraw && source !== "ninguna" ? "cursor-crosshair" : "cursor-default"
              }`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />

            {/* Badge modelo real */}
            {source !== "ninguna" && modelStatus === "listo" && (
              <div className="absolute top-3 right-3 pointer-events-none z-20">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-950/90 border border-emerald-500 text-emerald-300 backdrop-blur shadow-lg">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  MODELO REAL YOLO (ONNX)
                </span>
              </div>
            )}

            {/* Pantalla sin fuente */}
            {source === "ninguna" && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 text-center bg-slate-950/85 backdrop-blur-sm">
                <div className="h-16 w-16 rounded-full bg-slate-800/80 flex items-center justify-center mb-4 border border-slate-700">
                  <Video className="h-8 w-8 text-cyan-400 animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold text-white">Cámara Inactiva</h3>
                <p className="mt-2 text-sm text-slate-400 max-w-md">
                  Haz clic en <strong className="text-cyan-400 font-semibold">"Activar Cámara"</strong> o sube un video para iniciar la detección real con YOLO.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={() => startWebcam(deviceId || undefined)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 transition shadow-lg shadow-emerald-500/20"
                  >
                    <Camera className="h-5 w-5" />
                    ACTIVAR CÁMARA WEB
                  </button>
                  <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-slate-800 border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition">
                    <Upload className="h-4 w-4 text-cyan-400" />
                    Subir Video
                    <input type="file" accept="video/*" onChange={onFile} className="sr-only" />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-2 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              {canDraw
                ? "Arrastra sobre el video para definir zonas de conteo (máx. 4)."
                : `Límite máximo alcanzado (${MAX_ZONES} zonas).`}
            </span>
            {zones.length > 0 && (
              <button
                onClick={() => commitZones([])}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Reiniciar Zonas
              </button>
            )}
          </div>
        </section>

        {/* Panel lateral */}
        <aside className="flex flex-col gap-6">
          {/* Controles de entrada */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur">
            <h2 className="text-sm font-bold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <Camera className="h-4 w-4 text-cyan-400" />
              Fuente de Video
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {devices.length > 1 && (
                <select
                  value={deviceId}
                  onChange={(e) => { setDeviceId(e.target.value); startWebcam(e.target.value); }}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  {devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Cámara ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => startWebcam(deviceId || undefined)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition shadow-lg ${
                  source === "webcam"
                    ? "bg-emerald-600 text-white shadow-emerald-600/30"
                    : "bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-cyan-500/20"
                }`}
              >
                <Camera className="h-4 w-4" />
                {source === "webcam" ? "Cámara Activa ✓" : "ACTIVAR CÁMARA WEB"}
              </button>

              <label
                className={`inline-flex items-center justify-center gap-2 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  source === "file"
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                <Upload className="h-4 w-4" />
                Subir Video de Tráfico
                <input type="file" accept="video/*" onChange={onFile} className="sr-only" />
              </label>
            </div>
          </div>

          {/* Métricas */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur">
            <h2 className="text-sm font-bold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              Métricas en Tiempo Real
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <span className="text-slate-400">Estado Modelo</span>
                <p className="mt-1 font-bold text-slate-100 flex items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      modelStatus === "listo"
                        ? "bg-emerald-400 animate-pulse"
                        : modelStatus === "cargando"
                        ? "bg-blue-400 animate-pulse"
                        : "bg-rose-400"
                    }`}
                  />
                  {modelStatus === "cargando" && "Cargando…"}
                  {modelStatus === "listo" && "ONNX Real ✓"}
                  {modelStatus === "error" && "Error"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <span className="text-slate-400">Objetos Detectados</span>
                <p className="mt-1 font-bold text-cyan-400 text-lg">{total}</p>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <span className="text-slate-400">FPS / Latencia Inferencia</span>
                <p className="mt-1 font-bold text-amber-400 text-lg">
                  {fps} FPS <span className="text-xs text-slate-400 font-normal">({inferMs} ms)</span>
                </p>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                <span className="text-slate-400">Zonas Activas</span>
                <p className="mt-1 font-bold text-purple-400 text-lg">{zones.length}</p>
              </div>
            </div>
          </div>

          {/* Semáforos */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur">
            <h2 className="text-sm font-bold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-400" />
              Semáforos Adaptativos
            </h2>

            {zones.length === 0 ? (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-center text-xs text-slate-400">
                Dibuja zonas sobre el video para activar los semáforos inteligentes.
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {zones.map((_, i) => {
                  const state = lights[i] ?? "red";
                  const theme = ZONE_COLORS[i % ZONE_COLORS.length];
                  return (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5 rounded-lg bg-slate-900 p-2 border border-slate-800">
                          {(["red", "yellow", "green"] as LightState[]).map((s) => (
                            <span
                              key={s}
                              className={`h-3.5 w-3.5 rounded-full transition-all duration-300 ${
                                state === s ? "scale-110 shadow-lg" : "opacity-25"
                              }`}
                              style={{
                                backgroundColor: LIGHT_COLOR[s],
                                boxShadow: state === s ? `0 0 10px ${LIGHT_COLOR[s]}` : "none",
                              }}
                            />
                          ))}
                        </div>
                        <div>
                          <div className="text-xs font-bold" style={{ color: theme.text }}>
                            Zona {i + 1}
                          </div>
                          <div className="text-[11px] text-slate-400">{counts[i] ?? 0} vehículos</div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          state === "green"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : state === "yellow"
                            ? "bg-amber-950 text-amber-400 border border-amber-800"
                            : "bg-rose-950 text-rose-400 border border-rose-800"
                        }`}
                      >
                        {state === "green" ? "VERDE" : state === "yellow" ? "AMARILLO" : "ROJO"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-800/80 bg-rose-950/50 p-4 text-xs text-rose-300 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
