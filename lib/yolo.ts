// Detector YOLO para navegadores — Ultra-optimizado en JS (Decodificación directa en <2ms)
// Carga onnxruntime-web via <script> tag desde /ort-wasm/ort.min.js (local, sin CDN).

export type Detection = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
  classId: number;
};

// 80 Clases COCO traducidas al español
export const COCO_CLASSES: Record<number, string> = {
  0: "persona",
  1: "bicicleta",
  2: "carro",
  3: "motocicleta",
  4: "avión",
  5: "autobús",
  6: "tren",
  7: "camión",
  8: "barco",
  9: "semáforo",
  10: "boca de incendio",
  11: "señal de pare",
  12: "parquímetro",
  13: "banca",
  14: "pájaro",
  15: "gato",
  16: "perro",
  17: "caballo",
  18: "oveja",
  19: "vaca",
  20: "elefante",
  21: "oso",
  22: "cebra",
  23: "jirafa",
  24: "mochila",
  25: "sombrilla",
  26: "bolso",
  27: "corbata",
  28: "maleta",
  29: "frisbee",
  30: "esquís",
  31: "snowboard",
  32: "pelota",
  33: "cometa",
  34: "bate de béisbol",
  35: "guante de béisbol",
  36: "patineta",
  37: "tabla de surf",
  38: "raqueta de tenis",
  39: "botella",
  40: "copa de vino",
  41: "taza",
  42: "tenedor",
  43: "cuchillo",
  44: "cuchara",
  45: "tazón",
  46: "plátano",
  47: "manzana",
  48: "sándwich",
  49: "naranja",
  50: "brócoli",
  51: "zanahoria",
  52: "hot dog",
  53: "pizza",
  54: "dona",
  55: "pastel",
  56: "silla",
  57: "sofá",
  58: "planta",
  59: "cama",
  60: "mesa",
  61: "inodoro",
  62: "televisor",
  63: "laptop",
  64: "mouse",
  65: "control remoto",
  66: "teclado",
  67: "celular",
  68: "microondas",
  69: "horno",
  70: "tostadora",
  71: "fregadero",
  72: "refrigerador",
  73: "libro",
  74: "reloj",
  75: "florero",
  76: "tijeras",
  77: "peluche",
  78: "secador",
  79: "cepillo de dientes",
};

export const VEHICLE_CLASSES = COCO_CLASSES;

const INPUT_SIZE = 640;
const INV_255 = 1 / 255;

export type Options = {
  confThreshold?: number;
  iouThreshold?: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function iou(a: Detection, b: Detection): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = ix * iy;
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return union > 0 ? inter / union : 0;
}

function nms(dets: Detection[], iouThr: number): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const keep: Detection[] = [];
  for (const d of sorted) {
    if (keep.every((k) => iou(k, d) < iouThr)) keep.push(d);
  }
  return keep;
}

function loadOrtScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).ort) { resolve(); return; }
    const existing = document.getElementById("ort-local");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id   = "ort-local";
    s.src  = "/ort-wasm/ort.min.js";
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar /ort-wasm/ort.min.js"));
    document.head.appendChild(s);
  });
}

export class YoloDetector {
  public backend: string;
  private ort: any;
  private session: any;
  private inputName: string;
  private conf: number;
  private iouThr: number;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: Float32Array;

  private constructor(ort: any, session: any, backend: string, opts: Options) {
    this.ort       = ort;
    this.session   = session;
    this.backend   = backend;
    this.inputName = session.inputNames[0] ?? "images";
    this.conf      = opts.confThreshold ?? 0.30;
    this.iouThr    = opts.iouThreshold  ?? 0.45;

    this.canvas    = document.createElement("canvas");
    this.canvas.width  = INPUT_SIZE;
    this.canvas.height = INPUT_SIZE;
    this.ctx   = this.canvas.getContext("2d", { willReadFrequently: true })!;
    this.buffer = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  }

  static async create(modelUrl: string, opts: Options = {}): Promise<YoloDetector> {
    await loadOrtScript();
    const ort = (window as any).ort;
    if (!ort) throw new Error("onnxruntime-web no cargó correctamente.");

    ort.env.wasm.wasmPaths = "/ort-wasm/";
    ort.env.wasm.numThreads = 1; // 1 thread para máxima velocidad de bucle de eventos sin worker lock
    ort.env.wasm.simd = true;     // Activa SIMD para aceleración CPU de vectores

    console.log(`[YOLO] Cargando modelo ONNX (640x640) desde ${modelUrl}...`);

    // 1. Intentar WebGPU
    try {
      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ["webgpu"],
        graphOptimizationLevel: "all",
      });
      console.log("[YOLO] ⚡ Backend: WebGPU Activo");
      return new YoloDetector(ort, session, "WebGPU (GPU)", opts);
    } catch (gpuErr) {
      console.warn("[YOLO] WebGPU no disponible → usando WASM (CPU SIMD)");
    }

    // 2. Fallback WASM CPU
    const session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    console.log("[YOLO] ⚡ Backend: WASM (CPU SIMD)");
    return new YoloDetector(ort, session, "WASM (CPU)", opts);
  }

  async detect(video: HTMLVideoElement): Promise<Detection[]> {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return [];

    const scale = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh);
    const nw    = Math.round(vw * scale);
    const nh    = Math.round(vh * scale);
    const padX  = Math.floor((INPUT_SIZE - nw) / 2);
    const padY  = Math.floor((INPUT_SIZE - nh) / 2);

    this.ctx.fillStyle = "rgb(114,114,114)";
    this.ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    this.ctx.drawImage(video, padX, padY, nw, nh);

    const { data } = this.ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const plane = INPUT_SIZE * INPUT_SIZE;
    const buf   = this.buffer;

    // Preprocesamiento acelerado con multiplicación directa
    for (let i = 0; i < plane; i++) {
      const j = i * 4;
      buf[i]             = data[j]     * INV_255;
      buf[plane + i]     = data[j + 1] * INV_255;
      buf[2 * plane + i] = data[j + 2] * INV_255;
    }

    const tensor  = new this.ort.Tensor("float32", buf, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const results = await this.session.run({ [this.inputName]: tensor });
    const output  = results[this.session.outputNames[0]];

    return this.decode(output, scale, padX, padY, vw, vh);
  }

  private decode(
    output: any,
    scale: number,
    padX: number,
    padY: number,
    vw: number,
    vh: number
  ): Detection[] {
    const data = output.data as Float32Array;
    const dims = output.dims as number[];
    const [, a, b] = dims;

    const toVidX1 = (x1: number) => clamp((x1 - padX) / scale, 0, vw);
    const toVidY1 = (y1: number) => clamp((y1 - padY) / scale, 0, vh);
    const toVidX2 = (x2: number) => clamp((x2 - padX) / scale, 0, vw);
    const toVidY2 = (y2: number) => clamp((y2 - padY) / scale, 0, vh);

    const dets: Detection[] = [];

    // Formato NMS End-to-End [1, N, 6]
    if (b === 6 && a <= 1000) {
      for (let i = 0; i < a; i++) {
        const o       = i * 6;
        const score   = data[o + 4];
        const classId = Math.round(data[o + 5]);
        if (score < this.conf) continue;
        dets.push({
          x1: toVidX1(data[o]),
          y1: toVidY1(data[o + 1]),
          x2: toVidX2(data[o + 2]),
          y2: toVidY2(data[o + 3]),
          score,
          classId,
        });
      }
      return dets;
    }

    // Formato Standard YOLOv8 [1, 84, 8400] — Decodificación ultra-rápida sin closures ni llamadas a funciones
    const chFirst  = a < b; // true para [1, 84, 8400]
    const channels = chFirst ? a : b; // 84
    const anchors  = chFirst ? b : a; // 8400
    const numClasses = channels - 4; // 80

    if (chFirst) {
      const stride = anchors; // 8400
      const row0 = 0;
      const row1 = stride;
      const row2 = 2 * stride;
      const row3 = 3 * stride;

      for (let i = 0; i < anchors; i++) {
        let bestId = -1;
        let bestScore = this.conf;

        // Búsqueda directa en memoria sin invocar funciones intermedias
        for (let c = 0; c < numClasses; c++) {
          const s = data[(4 + c) * stride + i];
          if (s > bestScore) {
            bestScore = s;
            bestId = c;
          }
        }

        if (bestId >= 0) {
          const cx = data[row0 + i];
          const cy = data[row1 + i];
          const w  = data[row2 + i];
          const h  = data[row3 + i];

          const x1 = cx - w * 0.5;
          const y1 = cy - h * 0.5;
          const x2 = cx + w * 0.5;
          const y2 = cy + h * 0.5;

          dets.push({
            x1: toVidX1(x1),
            y1: toVidY1(y1),
            x2: toVidX2(x2),
            y2: toVidY2(y2),
            score: bestScore,
            classId: bestId,
          });
        }
      }
    } else {
      // Formato alternativo [1, 8400, 84]
      for (let i = 0; i < anchors; i++) {
        const offset = i * channels;
        let bestId = -1;
        let bestScore = this.conf;

        for (let c = 0; c < numClasses; c++) {
          const s = data[offset + 4 + c];
          if (s > bestScore) {
            bestScore = s;
            bestId = c;
          }
        }

        if (bestId >= 0) {
          const cx = data[offset];
          const cy = data[offset + 1];
          const w  = data[offset + 2];
          const h  = data[offset + 3];

          dets.push({
            x1: toVidX1(cx - w * 0.5),
            y1: toVidY1(cy - h * 0.5),
            x2: toVidX2(cx + w * 0.5),
            y2: toVidY2(cy + h * 0.5),
            score: bestScore,
            classId: bestId,
          });
        }
      }
    }

    return nms(dets, this.iouThr);
  }

  dispose() {
    this.session?.release?.().catch?.(() => {});
  }
}
