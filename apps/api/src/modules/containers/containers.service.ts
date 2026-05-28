import { prisma } from "../../lib/prisma.js";

export async function listContainersForMap() {
  const contenedores = await prisma.contenedor.findMany({
    include: {
      resultadoIa: true,
      sensores: {
        include: {
          lecturas: {
            orderBy: { fechaHora: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return contenedores.map((c) => ({
    id: c.idContenedor,
    ubicacion: c.ubicacion,
    latitud: c.latitud ? Number(c.latitud) : null,
    longitud: c.longitud ? Number(c.longitud) : null,
    capacidad: c.capacidad,
    estado: c.estado,
    ia: c.resultadoIa
      ? {
          prioridad: c.resultadoIa.prioridad,
          score: c.resultadoIa.score,
          volumenPct: c.resultadoIa.volumenPct,
          fechaClasificacion: c.resultadoIa.fechaClasificacion,
        }
      : null,
    ultimaLectura: c.sensores
      .flatMap((s) => s.lecturas)
      .sort((a, b) => {
        const ta = a.fechaHora?.getTime() ?? 0;
        const tb = b.fechaHora?.getTime() ?? 0;
        return tb - ta;
      })[0] ?? null,
  }));
}

export async function getDashboardStats() {
  const [total, conIa, alta] = await Promise.all([
    prisma.contenedor.count(),
    prisma.resultadoIa.count(),
    prisma.resultadoIa.count({ where: { prioridad: "alta" } }),
  ]);

  return { totalContenedores: total, conClasificacion: conIa, prioridadAlta: alta };
}
