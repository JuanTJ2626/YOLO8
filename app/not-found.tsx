import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
      <h2 className="text-3xl font-bold text-cyan-400">404 - Página no encontrada</h2>
      <p className="mt-2 text-slate-400">La ruta solicitada no existe en esta aplicación.</p>
      <Link
        href="/demo"
        className="mt-6 px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition"
      >
        Ir a la Demo de Tráfico
      </Link>
    </div>
  );
}
