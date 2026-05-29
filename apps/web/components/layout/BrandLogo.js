"use client";

import Link from "next/link";

/**
 * Logo ATLAS WASTE — coloca tu imagen en public/atlas/logo.png (desde PaginaPrincipal).
 * Si no existe, se usa public/atlas/logo.svg.
 */
export function BrandLogo({ size = "md", href = "/", showText = true, className = "" }) {
  const sizes = {
    sm: { img: 32, text: "text-sm" },
    md: { img: 40, text: "text-base" },
    lg: { img: 56, text: "text-xl" },
    hero: { img: 88, text: "text-3xl" },
  };
  const s = sizes[size] || sizes.md;

  const inner = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="relative shrink-0 rounded-xl overflow-hidden bg-slate-900 border border-emerald-500/30 flex items-center justify-center"
        style={{ width: s.img, height: s.img }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/atlas/logo.png"
          alt=""
          width={s.img}
          height={s.img}
          className="object-contain p-1 w-full h-full"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/atlas/logo.svg";
          }}
        />
      </div>
      {showText && (
        <div className="leading-tight">
          <span className={`block font-extrabold tracking-tight text-white ${s.text}`}>
            ATLAS <span className="text-emerald-400">WASTE</span>
          </span>
          <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
            Gestión inteligente
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}
