/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Necesario para que onnxruntime-web pueda cargar los archivos .wasm correctamente
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Tratar los archivos .wasm de onnxruntime-web como assets estáticos
      config.module.rules.push({
        test: /\.wasm$/,
        type: "asset/resource",
      });
    }
    return config;
  },

  // Headers necesarios para SharedArrayBuffer (multi-threading WASM)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy",  value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
