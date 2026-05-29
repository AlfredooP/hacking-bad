"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Ruta legada → administración */
export default function CamionesLegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/admin/camiones");
  }, [router]);
  return null;
}
