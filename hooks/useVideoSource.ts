"use client";

import { useCallback, useRef, useState } from "react";
import type { VideoSource } from "@/lib/types";

export function useVideoSource(
  videoRef: React.RefObject<HTMLVideoElement>,
  onError: (msg: string) => void,
) {
  const streamRef  = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);

  const [source,   setSource]   = useState<VideoSource>("ninguna");
  const [devices,  setDevices]  = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");

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
  }, [videoRef]);

  const startWebcam = useCallback(async (id?: string) => {
    try {
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
        (d) => d.kind === "videoinput",
      );
      setDevices(list);
      const active = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (active) setDeviceId(active);
    } catch (e) {
      onError(
        "No se pudo acceder a la cámara. Verifica los permisos en tu navegador: " +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  }, [stopSource, videoRef, onError]);

  const onFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
  }, [stopSource, videoRef]);

  return {
    source, stopSource,
    startWebcam, onFile,
    devices, deviceId, setDeviceId,
  };
}
