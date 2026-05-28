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
    tipoResiduo: c.tipoResiduo,
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
  const [total, conIa, alta, totalT, activeT, avgVolRes] = await Promise.all([
    prisma.contenedor.count(),
    prisma.resultadoIa.count(),
    prisma.resultadoIa.count({ where: { prioridad: "alta" } }),
    prisma.camion.count(),
    prisma.camion.count({ where: { estado: "Disponible" } }),
    prisma.resultadoIa.aggregate({ _avg: { volumenPct: true } }),
  ]);

  return {
    totalContenedores: total,
    conClasificacion: conIa,
    prioridadAlta: alta,
    totalTrucks: totalT,
    activeTrucks: activeT,
    avgVolume: avgVolRes._avg.volumenPct ? Math.round(avgVolRes._avg.volumenPct) : 0,
  };
}

export async function updateContainer(id: number, data: { estado?: string; tipoResiduo?: string; latitud?: number; longitud?: number; capacidad?: string }) {
  return prisma.contenedor.update({
    where: { idContenedor: id },
    data: {
      estado: data.estado,
      tipoResiduo: data.tipoResiduo,
      latitud: data.latitud,
      longitud: data.longitud,
      capacidad: data.capacidad,
    },
  });
}

export async function emptyContainer(id: number) {
  // Update state to "Vacío"
  await prisma.contenedor.update({
    where: { idContenedor: id },
    data: { estado: "Vacío" },
  });

  // Update AI results to 0% volume and low priority
  await prisma.resultadoIa.upsert({
    where: { idContenedor: id },
    create: {
      idContenedor: id,
      prioridad: "baja",
      score: 1.0,
      volumenPct: 0.0,
      temperatura: 20.0,
      humedad: 40.0,
      pesoKg: 0.0,
    },
    update: {
      prioridad: "baja",
      score: 1.0,
      volumenPct: 0.0,
      pesoKg: 0.0,
      fechaClasificacion: new Date(),
    },
  });
}

