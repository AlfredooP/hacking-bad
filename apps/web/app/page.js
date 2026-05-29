import Link from "next/link";
import { BrandLogo } from "@/components/layout/BrandLogo";

const FEATURES = [
  {
    title: "Mapa en tiempo real",
    desc: "Regiones, zonas y contenedores inteligentes con sensores IoT y priorización automática.",
    icon: "🗺️",
  },
  {
    title: "Inferencia de residuos",
    desc: "Compara el tipo esperado vs. el detectado y genera alertas de contaminación.",
    icon: "🧠",
  },
  {
    title: "Logística optimizada",
    desc: "Rutas inteligentes, flota compatible y simulación de recolección.",
    icon: "🚛",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-teal-600/10 blur-[100px] rounded-full" />
      </div>

      <header className="relative z-10 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo size="md" href="/" />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link href="/registro" className="btn-primary text-sm py-2 px-5">
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16 md:py-24">
        <section className="text-center space-y-8 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-widest">
            Plataforma de gestión de residuos
          </div>

          <BrandLogo size="hero" href={null} className="justify-center" />

          <p className="text-lg md:text-xl text-slate-400 leading-relaxed">
            <strong className="text-white font-semibold">ATLAS WASTE</strong> centraliza el monitoreo de
            contenedores, la clasificación por IA y la operación de recolección en un solo panel
            geoespacial.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/login" className="btn-primary text-base px-8 py-3 w-full sm:w-auto text-center">
              Acceder al sistema
            </Link>
            <Link
              href="/registro"
              className="w-full sm:w-auto text-center px-8 py-3 rounded-lg border border-slate-600 text-slate-200 font-semibold hover:border-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Crear cuenta
            </Link>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 mt-20">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card border-slate-800/80 bg-slate-900/40 hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1"
            >
              <span className="text-3xl mb-3 block">{f.icon}</span>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-20 card bg-gradient-to-br from-slate-900/90 to-emerald-950/30 border-emerald-500/20 text-center py-10">
          <h2 className="text-2xl font-bold text-white mb-2">¿Listo para operar?</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-lg mx-auto">
            Coloca tu logo personalizado en <code className="text-emerald-400">public/atlas/logo.png</code>{" "}
            (carpeta PaginaPrincipal del proyecto).
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Entrar a ATLAS WASTE
          </Link>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-800 py-6 text-center text-xs text-slate-600">
        ATLAS WASTE — Gestión inteligente de residuos
      </footer>
    </div>
  );
}
