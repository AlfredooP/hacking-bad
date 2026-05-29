"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Ruta legada → administración */
export default function ContenedoresLegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/admin/contenedores");
  }, [router]);
  return null;
}
