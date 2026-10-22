"use client";

import { useEffect, useRef, useState } from "react";
import { COCO_CLASSES, YoloDetector, type Detection } from "@/lib/yolo";
import { TrafficController, type LightState } from "@/lib/trafficController";
import type { Zone } from "@/lib/types";

const LIGHT_COLOR: Record<LightState, string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  red:   "#ef4444",
};

const ZONE_COLORS = [
  { border: "#3b82f6", bg: "rgba(59, 130, 246, 0.18)", text: "#60a5fa" },
  { border: "#10b981", bg: "rgba(16, 185, 129, 0.18)", text: "#34d399" },
  { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.18)", text: "#fbbf24" },
  { border: "#a855f7", bg: "rgba(168, 85, 247, 0.18)", text: "#c084fc" },
];

interface Props {
  videoRef:    React.RefObject<HTMLVideoElement>;
  canvasRef:   React.RefObject<HTMLCanvasElement>;
  detectorRef: React.RefObject<YoloDetector | null>;
  zonesRef:    React.MutableRefObject<Zone[]>;
  draftRef:    React.MutableRefObject<Zone | null>;
  onError:     (msg: string) => void;
  onResize:    (aspect: number) => void;
  onUpdate:    (backend: string) => void;
}

export function useInferenceLoop({
  videoRef, canvasRef, detectorRef,
  zonesRef, draftRef,
  onError, onResize, onUpdate,
}: Props) {
  const controllerRef = useRef(new TrafficController(0));
  const detsRef       = useRef<Detection[]>([]);
  const lightsRef     = useRef<LightState[]>([]);

  const [counts, setCounts] = useState<number[]>([]);
  const [lights, setLights] = useState<LightState[]>([]);
  const [total,  setTotal]  = useState(0);
  const [fps,    setFps]    = useState(0);
  const [inferMs, setInferMs] = useState(0);

  // Exponer setZones para que la página pueda reiniciar el controlador
  const commitZones = (next: Zone[]) => {
    zonesRef.current = next;
    controllerRef.current = new TrafficController(next.length);
    lightsRef.current = next.map(() => "red" as LightState);
    setCounts(next.map(() => 0));
    setLights(next.map(() => "red" as LightState));
  };

  useEffect(() => {
    let busy     = false;
    let disabled = false;
    let lastDone = 0;
    let fpsAvg   = 0;
    let lastUIUpdate = 0;

    const runInference = (video: HTMLVideoElement, det: YoloDetector) => {
      busy = true;
      const tStart = performance.now();
      det.detect(video)
        .then((dets) => {
          const lat = Math.round(performance.now() - tStart);
          detsRef.current = dets;

          const vw = video.videoWidth  || 1280;
          const vh = video.videoHeight || 720;
          const zs = zonesRef.current ?? [];
          const c  = zs.map(() => 0);
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
          const dt  = now - lastDone;
          lastDone  = now;
          if (dt > 0 && dt < 2000)
            fpsAvg = fpsAvg === 0 ? 1000 / dt : fpsAvg * 0.8 + (1000 / dt) * 0.2;

          if (now - lastUIUpdate > 200) {
            lastUIUpdate = now;
            onUpdate(det.backend);
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
          onError("Falló la inferencia: " + (e instanceof Error ? e.message : String(e)));
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

      // Zonas
      (zonesRef.current ?? []).forEach((z, i) => {
        const lightState = lightsRef.current[i] ?? "red";
        const theme = ZONE_COLORS[i % ZONE_COLORS.length];

        ctx.fillStyle   = theme.bg;
        ctx.strokeStyle = theme.border;
        ctx.lineWidth   = 3 * u;
        ctx.fillRect  (z.x * W, z.y * H, z.w * W, z.h * H);
        ctx.strokeRect(z.x * W, z.y * H, z.w * W, z.h * H);

        const labelText = `Zona ${i + 1} (${counts[i] ?? 0} veh)`;
        const tw = ctx.measureText(labelText).width + 12 * u;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(z.x * W, z.y * H, tw, 24 * u);
        ctx.fillStyle = theme.text;
        ctx.fillText(labelText, z.x * W + 6 * u, z.y * H + 4 * u);

        // Mini semáforo en canvas
        const boxX = z.x * W + z.w * W - 28 * u;
        const boxY = z.y * H + 6 * u;
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        if (ctx.roundRect) ctx.roundRect(boxX, boxY, 22 * u, 54 * u, 6 * u);
        else ctx.fillRect(boxX, boxY, 22 * u, 54 * u);
        ctx.fill();

        (["red", "yellow", "green"] as LightState[]).forEach((st, idx) => {
          const cy = boxY + 9 * u + idx * 17 * u;
          const cx = boxX + 11 * u;
          ctx.beginPath();
          ctx.arc(cx, cy, 5.5 * u, 0, Math.PI * 2);
          if (lightState === st) {
            ctx.fillStyle   = LIGHT_COLOR[st];
            ctx.shadowColor = LIGHT_COLOR[st];
            ctx.shadowBlur  = 10 * u;
          } else {
            ctx.fillStyle  = "rgba(255,255,255,0.15)";
            ctx.shadowBlur = 0;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      });

      // Zona borrador (mientras el usuario arrastra)
      const draft = draftRef.current;
      if (draft) {
        ctx.strokeStyle = "#38bdf8";
        ctx.setLineDash([6 * u, 4 * u]);
        ctx.lineWidth = 2 * u;
        ctx.strokeRect(draft.x * W, draft.y * H, draft.w * W, draft.h * H);
        ctx.setLineDash([]);
      }

      // Bounding boxes
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

    // Inferencia: setInterval para no bloquear el hilo principal
    const inferInterval = setInterval(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width  = vw;
        canvas.height = vh;
        onResize(vw / vh);
      }

      const det = detectorRef.current;
      if (det && !busy && !disabled) runInference(video, det);
    }, 0);

    // Dibujo: RAF independiente
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { counts, lights, total, fps, inferMs, commitZones, lightsRef, detsRef };
}
