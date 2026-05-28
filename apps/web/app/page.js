import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-bold mb-4 text-green-400">BIN NEXT</h1>
      <p className="text-lg text-slate-400 mb-8 max-w-md">
        Plataforma de gestión inteligente de contenedores con sensores IoT, mapas
        interactivos y priorización por IA.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="btn-primary">
          Iniciar sesión
        </Link>
        <Link
          href="/registro"
          className="px-5 py-2.5 rounded-lg border border-slate-600 hover:border-green-500"
        >
          Registrarse
        </Link>
      </div>
    </main>
  );
}
