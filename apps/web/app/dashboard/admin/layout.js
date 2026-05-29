"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { isAdminRole } from "@/lib/navigation";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((d) => {
        if (!isAdminRole(d.user?.rol)) {
          router.replace("/dashboard");
        } else {
          setAllowed(true);
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!allowed) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-400 text-sm">
        Verificando permisos de administrador…
      </div>
    );
  }

  return children;
}
