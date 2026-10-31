"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mqtt, { type MqttClient } from "mqtt";

const TOPIC = process.env.NEXT_PUBLIC_MQTT_TOPIC ?? "semaforos/estado";

export type MqttStatus = "conectando" | "conectado" | "desconectado" | "error";

export function useMqttSemaforos() {
  const clientRef = useRef<MqttClient | null>(null);
  const lastRef   = useRef("");

  const [status, setStatus] = useState<MqttStatus>("conectando");
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_MQTT_URL;
    if (!url) {
      setStatus("error");
      setError("Falta NEXT_PUBLIC_MQTT_URL en .env.local");
      return;
    }

    const client = mqtt.connect(url, {
      username:        process.env.NEXT_PUBLIC_MQTT_USER,
      password:        process.env.NEXT_PUBLIC_MQTT_PASS,
      clientId:        "web-" + Math.random().toString(16).slice(2, 10),
      reconnectPeriod: 2000,
      connectTimeout:  8000,
    });
    clientRef.current = client;

    client.on("connect", () => { setStatus("conectado"); setError(null); });
    client.on("close",   () => setStatus("desconectado"));
    client.on("error",   (e) => { setStatus("error"); setError(e.message); });

    // Reenvía el último estado cada 2s (fail-safe para el ESP32)
    const timer = setInterval(() => {
      if (client.connected && lastRef.current) {
        client.publish(TOPIC, lastRef.current);
      }
    }, 2000);

    return () => {
      clearInterval(timer);
      client.end(true);
    };
  }, []);

  // states: e.g. ["G","R","R","R"]  G=verde Y=amarillo R=rojo
  const send = useCallback((states: string[]) => {
    const msg     = states.join(",");
    const changed = msg !== lastRef.current;
    lastRef.current = msg;
    if (changed && clientRef.current?.connected) {
      clientRef.current.publish(TOPIC, msg);
    }
  }, []);

  return { send, status, error, connected: status === "conectado" };
}
