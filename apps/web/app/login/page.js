"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { BrandLogo } from "@/components/layout/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)]">
      <div className="mb-8">
        <BrandLogo size="lg" href="/" />
      </div>
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4 border-slate-800">
        <h1 className="text-2xl font-bold text-white">Iniciar sesión</h1>
        <p className="text-slate-500 text-sm">Accede al panel ATLAS WASTE</p>
        {error && <p className="text-red-400 text-sm bg-red-950/30 p-2 rounded border border-red-900/40">{error}</p>}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input w-full"
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-sm text-slate-400 text-center">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="text-emerald-400 hover:underline font-semibold">
            Regístrate
          </Link>
        </p>
        <p className="text-center">
          <Link href="/" className="text-xs text-slate-600 hover:text-slate-400">
            ← Volver al inicio
          </Link>
        </p>
      </form>
    </main>
  );
}
