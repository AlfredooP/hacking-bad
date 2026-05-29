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

function parseCapacityLiters(capacidad: string | null | undefined): number {
  if (!capacidad) return 0;
  const match = capacidad.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function getDashboardStats() {
  const containers = await listContainersForMap();

  const humedades: number[] = [];
  const temperaturas: number[] = [];
  const scores: number[] = [];

  for (const c of containers) {
    if (c.ultimaLectura?.humedad != null) humedades.push(c.ultimaLectura.humedad);
    if (c.ultimaLectura?.tempCelsius != null) temperaturas.push(c.ultimaLectura.tempCelsius);
    if (c.ia?.score != null) scores.push(c.ia.score);
  }

  const prioridades = { alta: 0, media: 0, baja: 0 };
  for (const c of containers) {
    const p = c.ia?.prioridad ?? "baja";
    if (p in prioridades) prioridades[p as keyof typeof prioridades]++;
    else prioridades.baja++;
  }

  const humedadPromedio = average(humedades);
  const tempPromedio = average(temperaturas);
  const confianzaIa = scores.length ? (average(scores) ?? 0) * 100 : 0;

  return {
    totalContenedores: containers.length,
    alertasCriticas: prioridades.alta,
    conClasificacion: containers.filter((c) => c.ia).length,
    prioridadAlta: prioridades.alta,
    humedadPromedio: humedadPromedio != null ? Math.round(humedadPromedio * 10) / 10 : null,
    tempPromedio: tempPromedio != null ? Math.round(tempPromedio * 10) / 10 : null,
    capacidadTotal: containers.reduce((sum, c) => sum + parseCapacityLiters(c.capacidad), 0),
    confianzaIa: Math.round(confianzaIa * 10) / 10,
    charts: {
      llenado: containers.map((c) => ({
        label: c.ubicacion || `Contenedor ${c.id}`,
        value: Math.round(c.ia?.volumenPct ?? 0),
      })),
      prioridades: {
        alta: prioridades.alta,
        media: prioridades.media,
        normal: prioridades.baja,
      },
    },
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

