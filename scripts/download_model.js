const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");

const urls = [
  "https://raw.githubusercontent.com/hyuto/yolov8-onnxruntime-web/master/public/model/yolov8n.onnx",
  "https://huggingface.co/SpotLab/YOLOv8Detection/resolve/main/yolov8n.onnx"
];

const destDir = path.join(__dirname, "..", "public", "models");
const destPath = path.join(destDir, "yolov8n.onnx");

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

function download(urlIndex) {
  if (urlIndex >= urls.length) {
    console.error("[DOWNLOAD] Fallaron todas las fuentes.");
    process.exit(1);
  }

  const url = urls[urlIndex];
  console.log(`\n[DOWNLOAD] Probando: ${url}`);

  function doFetch(fetchUrl) {
    const req = (fetchUrl.startsWith("https") ? https : http).get(
      fetchUrl,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log(`[DOWNLOAD] Redirigiendo a: ${res.headers.location}`);
          return doFetch(res.headers.location);
        }
        if (res.statusCode !== 200) {
          console.error(`[DOWNLOAD] HTTP Error ${res.statusCode}`);
          return download(urlIndex + 1);
        }

        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        const file = fs.createWriteStream(destPath);

        res.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`\r[DOWNLOAD] Progreso: ${pct}% (${(downloaded / 1024 / 1024).toFixed(2)} MB)`);
          } else {
            process.stdout.write(`\r[DOWNLOAD] Descargado: ${(downloaded / 1024 / 1024).toFixed(2)} MB`);
          }
        });

        res.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            console.log("\n[DOWNLOAD] ✅ ¡Modelo yolov8n.onnx descargado con éxito!");
            process.exit(0);
          });
        });
      }
    );

    req.on("error", (err) => {
      console.error(`\n[DOWNLOAD] Error de red: ${err.message}`);
      download(urlIndex + 1);
    });
  }

  doFetch(url);
}

download(0);
