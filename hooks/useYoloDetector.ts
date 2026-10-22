"use client";

import { useEffect, useRef, useState } from "react";
import { YoloDetector } from "@/lib/yolo";
import type { ModelStatus } from "@/lib/types";

const MODEL_URL = "/models/yolo26n_webgpu.onnx";

export function useYoloDetector() {
  const detectorRef = useRef<YoloDetector | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("cargando");
  const [backend, setBackend] = useState("");

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
        if (!cancelled) setModelStatus("error");
        console.error("[YOLO26n] Error al cargar el modelo:", e);
      });

    return () => {
      cancelled = true;
      detectorRef.current?.dispose();
      detectorRef.current = null;
    };
  }, []);

  return { detectorRef, modelStatus, backend, setBackend };
}
