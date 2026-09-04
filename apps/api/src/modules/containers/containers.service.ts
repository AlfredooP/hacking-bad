import { PrioridadIa, type Contenedor, type Prisma, type ResultadoIa } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { maxPriority, parseAllowedTypes } from "./waste-types.js";

type ContainerWithRelations = Contenedor & {
  resultadoIa: ResultadoIa | null;
  sensores: {
    idSensor: number;
    tipoSensor: string | null;
    lecturas: {
      idLectura: number;
      fechaHora: Date | null;
      tempCelsius: number | null;
      humedad: number | null;
      densidad: number | null;
      distanciaBoteTapa: number | null;
      pesoKg: number | null;
    }[];
  }[];
};

const containerInclude = {
  resultadoIa: true,
  sensores: {
    include: {
      lecturas: {
        orderBy: { fechaHora: "desc" as const },
        take: 1,
      },
    },
  },
};

function parseCapacidadLitros(c: Contenedor): number | null {
  if (c.capacidadMax && c.capacidadMax > 0) return c.capacidadMax;
  const capMatch = c.capacidad?.match(/(\d+)/);
  return capMatch ? parseInt(capMatch[1], 10) : null;
}

function formatContainer(c: ContainerWithRelations) {
  const ultimaLectura = c.sensores
    .flatMap((s) => s.lecturas)
    .sort((a, b) => {
      const ta = a.fechaHora?.getTime() ?? 0;
      const tb = b.fechaHora?.getTime() ?? 0;
      return tb - ta;
    })[0] ?? null;

  const iaPrioridad = c.resultadoIa?.prioridad ?? "baja";
  const prioridadEfectiva = c.resultadoIa?.contaminacionDetectada
    ? "alta"
    : maxPriority(iaPrioridad, c.prioridadConfigurada);

  return {
    id: c.idContenedor,
    nombre: c.nombre,
    ubicacion: c.ubicacion,
    zona: c.zona,
    idZone: c.idZone ?? null,
    latitud: c.latitud ? Number(c.latitud) : null,
    longitud: c.longitud ? Number(c.longitud) : null,
    capacidad: c.capacidad,
    capacidadMax: c.capacidadMax,
    estado: c.estado,
    estadoOperativo: c.estadoOperativo,
    tipoResiduo: c.tipoResiduo,
    tiposResiduosPermitidos: parseAllowedTypes(c.tiposResiduosPermitidos),
    prioridadConfigurada: c.prioridadConfigurada,
    sensores: c.sensores.map((s) => ({
      id: s.idSensor,
      tipo: s.tipoSensor,
    })),
    ia: c.resultadoIa
      ? {
          prioridad: c.resultadoIa.prioridad,
          prioridadEfectiva,
          score: c.resultadoIa.score,
          volumenPct: c.resultadoIa.volumenPct,
          densidad: c.resultadoIa.densidad,
          tipoResiduoInferido: c.resultadoIa.tipoResiduoInferido,
          confianzaInferencia: c.resultadoIa.confianzaInferencia,
          contaminacionDetectada: c.resultadoIa.contaminacionDetectada,
          mensajeContaminacion: c.resultadoIa.mensajeContaminacion,
          fechaClasificacion: c.resultadoIa.fechaClasificacion,
        }
      : null,
    ultimaLectura: ultimaLectura
      ? {
          tempCelsius: ultimaLectura.tempCelsius,
          humedad: ultimaLectura.humedad,
          densidad: ultimaLectura.densidad,
          distanciaBoteTapa: ultimaLectura.distanciaBoteTapa,
          pesoKg: ultimaLectura.pesoKg,
          fechaHora: ultimaLectura.fechaHora,
        }
      : null,
  };
}

export async function listContainersForMap(filters?: {
  zona?: string;
  tipoResiduo?: string;
  prioridad?: string;
  soloContaminacion?: boolean;
}) {
  const contenedores = await prisma.contenedor.findMany({
    include: containerInclude,
    orderBy: { idContenedor: "asc" },
  });

  let formatted = contenedores.map(formatContainer);

  if (filters?.zona) {
    formatted = formatted.filter((c) => c.zona === filters.zona);
  }
  if (filters?.tipoResiduo) {
    const t = filters.tipoResiduo.toLowerCase();
    formatted = formatted.filter(
      (c) =>
        c.tipoResiduo?.toLowerCase() === t ||
        c.ia?.tipoResiduoInferido?.toLowerCase() === t ||
        c.tiposResiduosPermitidos.some((p) => p.toLowerCase() === t)
    );
  }
  if (filters?.prioridad) {
    formatted = formatted.filter((c) => c.ia?.prioridadEfectiva === filters.prioridad);
  }
  if (filters?.soloContaminacion) {
    formatted = formatted.filter((c) => c.ia?.contaminacionDetectada);
  }

  return formatted;
}

export async function getContainerById(id: number) {
  const c = await prisma.contenedor.findUnique({
    where: { idContenedor: id },
    include: containerInclude,
  });
  if (!c) return null;
  return formatContainer(c);
}

export async function getDashboardStats() {
  const [total, conIa, alta, contaminacion, totalT, activeT, avgVolRes] = await Promise.all([
    prisma.contenedor.count(),
    prisma.resultadoIa.count(),
    prisma.resultadoIa.count({ where: { prioridad: "alta" } }),
    prisma.resultadoIa.count({ where: { contaminacionDetectada: true } }),
    prisma.camion.count(),
    prisma.camion.count({ where: { estado: "Disponible" } }),
    prisma.resultadoIa.aggregate({ _avg: { volumenPct: true } }),
  ]);

  return {
    totalContenedores: total,
    conClasificacion: conIa,
    prioridadAlta: alta,
    alertasContaminacion: contaminacion,
    totalTrucks: totalT,
    activeTrucks: activeT,
    avgVolume: avgVolRes._avg.volumenPct ? Math.round(avgVolRes._avg.volumenPct) : 0,
  };
}

export interface CreateContainerInput {
  nombre: string;
  ubicacion?: string;
  zona?: string;
  latitud?: number;
  longitud?: number;
  capacidadMax?: number;
  estado?: string;
  estadoOperativo?: string;
  tipoResiduo?: string;
  tiposResiduosPermitidos?: string[];
  prioridadConfigurada?: PrioridadIa;
  sensores?: { tipoSensor: string }[];
}

export async function createContainer(data: CreateContainerInput) {
  const capacidadLabel = data.capacidadMax ? `${data.capacidadMax}L` : "200L";
  const allowed = data.tiposResiduosPermitidos?.length
    ? data.tiposResiduosPermitidos.join(",")
    : data.tipoResiduo ?? "Orgánicos";

  const container = await prisma.contenedor.create({
    data: {
      nombre: data.nombre,
      ubicacion: data.ubicacion ?? data.nombre,
      zona: data.zona,
      latitud: data.latitud,
      longitud: data.longitud,
      capacidad: capacidadLabel,
      capacidadMax: data.capacidadMax ?? 200,
      estado: data.estado ?? "Vacío",
      estadoOperativo: data.estadoOperativo ?? "Activo",
      tipoResiduo: data.tipoResiduo ?? "Orgánicos",
      tiposResiduosPermitidos: allowed,
      prioridadConfigurada: data.prioridadConfigurada,
      sensores: data.sensores?.length
        ? {
            create: data.sensores.map((s) => ({ tipoSensor: s.tipoSensor })),
          }
        : {
            create: [{ tipoSensor: "Multisensor" }],
          },
    },
    include: containerInclude,
  });

  return formatContainer(container);
}

export interface UpdateContainerInput {
  nombre?: string;
  ubicacion?: string;
  zona?: string;
  latitud?: number;
  longitud?: number;
  capacidadMax?: number;
  estado?: string;
  estadoOperativo?: string;
  tipoResiduo?: string;
  tiposResiduosPermitidos?: string[];
  prioridadConfigurada?: PrioridadIa | null;
}

export async function updateContainer(id: number, data: UpdateContainerInput) {
  const updateData: Prisma.ContenedorUpdateInput = {};

  if (data.nombre !== undefined) updateData.nombre = data.nombre;
  if (data.ubicacion !== undefined) updateData.ubicacion = data.ubicacion;
  if (data.zona !== undefined) updateData.zona = data.zona;
  if (data.latitud !== undefined) updateData.latitud = data.latitud;
  if (data.longitud !== undefined) updateData.longitud = data.longitud;
  if (data.capacidadMax !== undefined) {
    updateData.capacidadMax = data.capacidadMax;
    updateData.capacidad = `${data.capacidadMax}L`;
  }
  if (data.estado !== undefined) updateData.estado = data.estado;
  if (data.estadoOperativo !== undefined) updateData.estadoOperativo = data.estadoOperativo;
  if (data.tipoResiduo !== undefined) updateData.tipoResiduo = data.tipoResiduo;
  if (data.tiposResiduosPermitidos !== undefined) {
    updateData.tiposResiduosPermitidos = data.tiposResiduosPermitidos.join(",");
  }
  if (data.prioridadConfigurada !== undefined) {
    updateData.prioridadConfigurada = data.prioridadConfigurada;
  }

  const updated = await prisma.contenedor.update({
    where: { idContenedor: id },
    data: updateData,
    include: containerInclude,
  });

  return formatContainer(updated);
}

export async function deleteContainer(id: number) {
  await prisma.$transaction(async (transaction) => {
    await transaction.rutaContenedor.deleteMany({
      where: { idContenedor: id },
    });
    await transaction.lecturaSensor.deleteMany({
      where: { sensor: { idContenedor: id } },
    });
    await transaction.sensor.deleteMany({
      where: { idContenedor: id },
    });
    await transaction.resultadoIa.deleteMany({
      where: { idContenedor: id },
    });
    await transaction.alertaContaminacion.deleteMany({
      where: { idContenedor: id },
    });
    await transaction.contenedor.delete({ where: { idContenedor: id } });
  });
}

export async function listContaminationAlerts(resueltas?: boolean) {
  return prisma.alertaContaminacion.findMany({
    where: resueltas !== undefined ? { resuelta: resueltas } : undefined,
    include: {
      contenedor: {
        select: { idContenedor: true, nombre: true, ubicacion: true, zona: true },
      },
    },
    orderBy: { fechaDeteccion: "desc" },
    take: 50,
  });
}

export async function resolveContaminationAlert(alertId: number) {
  return prisma.alertaContaminacion.update({
    where: { id: alertId },
    data: { resuelta: true },
  });
}

export async function persistClassificationResult(
  containerId: number,
  r: {
    prioridad: string;
    score: number;
    volumenPct: number;
    temperatura?: number | null;
    humedad?: number | null;
    densidad?: number | null;
    pesoKg?: number | null;
    tipoResiduoInferido?: string | null;
    confianzaInferencia?: number | null;
    contaminacionDetectada?: boolean;
    mensajeContaminacion?: string | null;
  },
  container: Contenedor
) {
  await prisma.resultadoIa.upsert({
    where: { idContenedor: containerId },
    create: {
      idContenedor: containerId,
      prioridad: r.prioridad as PrioridadIa,
      score: r.score,
      volumenPct: r.volumenPct,
      temperatura: r.temperatura ?? undefined,
      humedad: r.humedad ?? undefined,
      densidad: r.densidad ?? undefined,
      pesoKg: r.pesoKg ?? undefined,
      tipoResiduoInferido: r.tipoResiduoInferido ?? undefined,
      confianzaInferencia: r.confianzaInferencia ?? undefined,
      contaminacionDetectada: r.contaminacionDetectada ?? false,
      mensajeContaminacion: r.mensajeContaminacion ?? undefined,
    },
    update: {
      prioridad: r.prioridad as PrioridadIa,
      score: r.score,
      volumenPct: r.volumenPct,
      temperatura: r.temperatura ?? undefined,
      humedad: r.humedad ?? undefined,
      densidad: r.densidad ?? undefined,
      pesoKg: r.pesoKg ?? undefined,
      tipoResiduoInferido: r.tipoResiduoInferido ?? undefined,
      confianzaInferencia: r.confianzaInferencia ?? undefined,
      contaminacionDetectada: r.contaminacionDetectada ?? false,
      mensajeContaminacion: r.mensajeContaminacion ?? undefined,
      fechaClasificacion: new Date(),
    },
  });

  if (r.contaminacionDetectada && r.tipoResiduoInferido) {
    await prisma.alertaContaminacion.create({
      data: {
        idContenedor: containerId,
        tipoEsperado: container.tipoResiduo,
        tipoInferido: r.tipoResiduoInferido,
        mensaje: r.mensajeContaminacion,
      },
    });
  }
}

export async function emptyContainer(id: number) {
  await prisma.contenedor.update({
    where: { idContenedor: id },
    data: { estado: "Vacío" },
  });

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
      contaminacionDetectada: false,
      mensajeContaminacion: null,
      tipoResiduoInferido: null,
    },
    update: {
      prioridad: "baja",
      score: 1.0,
      volumenPct: 0.0,
      pesoKg: 0.0,
      contaminacionDetectada: false,
      mensajeContaminacion: null,
      tipoResiduoInferido: null,
      fechaClasificacion: new Date(),
    },
  });
}

export function getCapacidadLitros(c: Contenedor): number | null {
  return parseCapacidadLitros(c);
}

export async function simulateTelemetryForContainers() {
  const containers = await prisma.contenedor.findMany({
    include: {
      sensores: true,
    },
  });

  const now = new Date();

  for (const c of containers) {
    // Make sure a sensor exists for this container
    let sensor = c.sensores[0];
    if (!sensor) {
      sensor = await prisma.sensor.create({
        data: {
          idContenedor: c.idContenedor,
          tipoSensor: "Multisensor",
        },
      });
    }

    // Generate 10 historical readings for the past 20 hours (one every 2 hours)
    for (let i = 9; i >= 0; i--) {
      const fechaHora = new Date(now.getTime() - i * 2 * 60 * 60 * 1000);
      
      // Random values
      const tempCelsius = 18.0 + Math.random() * 15.0;
      const humedad = 40.0 + Math.random() * 40.0;
      const volumenPct = Math.min(100, Math.max(0, Math.round(10 + (9 - i) * 8 + (Math.random() * 15 - 7.5)))); // slowly fills up over time
      const capMax = c.capacidadMax ?? 200;
      const pesoKg = Math.round(((volumenPct / 100) * (capMax * 0.12) + Math.random() * 2.0) * 100) / 100;
      const distanciaBoteTapa = Math.round((80.0 - (volumenPct / 100) * 75.0) * 100) / 100; // 80cm empty, 5cm full

      // Create raw sensor reading
      await prisma.lecturaSensor.create({
        data: {
          idSensor: sensor.idSensor,
          fechaHora,
          tempCelsius,
          humedad,
          distanciaBoteTapa,
          pesoKg,
          densidad: pesoKg / ((volumenPct || 1) * capMax / 100),
        },
      });

      // For the latest reading (i = 0), update current IA status
      if (i === 0) {
        const contaminacionDetectada = Math.random() < 0.15; // 15% chance
        const tipoResiduoInferido = contaminacionDetectada
          ? (c.tipoResiduo === "Orgánicos" ? "Reciclables" : "Orgánicos")
          : c.tipoResiduo;
        const mensajeContaminacion = contaminacionDetectada
          ? "Mezcla de materiales plásticos detectada"
          : null;
        
        const prioridad = volumenPct >= 80 ? "alta" : volumenPct >= 45 ? "media" : "baja";

        await prisma.resultadoIa.upsert({
          where: { idContenedor: c.idContenedor },
          create: {
            idContenedor: c.idContenedor,
            prioridad: prioridad as PrioridadIa,
            score: Math.round((0.85 + Math.random() * 0.15) * 100) / 100,
            volumenPct,
            temperatura: tempCelsius,
            humedad,
            pesoKg,
            densidad: pesoKg / ((volumenPct || 1) * capMax / 100),
            tipoResiduoInferido,
            confianzaInferencia: Math.round((0.75 + Math.random() * 0.23) * 100) / 100,
            contaminacionDetectada,
            mensajeContaminacion,
          },
          update: {
            prioridad: prioridad as PrioridadIa,
            score: Math.round((0.85 + Math.random() * 0.15) * 100) / 100,
            volumenPct,
            temperatura: tempCelsius,
            humedad,
            pesoKg,
            densidad: pesoKg / ((volumenPct || 1) * capMax / 100),
            tipoResiduoInferido,
            confianzaInferencia: Math.round((0.75 + Math.random() * 0.23) * 100) / 100,
            contaminacionDetectada,
            mensajeContaminacion,
            fechaClasificacion: new Date(),
          },
        });

        // Update container status label corresponding to volume
        let estado = "Vacío";
        if (volumenPct >= 80) estado = "Lleno";
        else if (volumenPct >= 35) estado = "Medio";

        await prisma.contenedor.update({
          where: { idContenedor: c.idContenedor },
          data: { estado },
        });

        // Add contamination alert
        if (contaminacionDetectada && tipoResiduoInferido) {
          await prisma.alertaContaminacion.create({
            data: {
              idContenedor: c.idContenedor,
              tipoEsperado: c.tipoResiduo,
              tipoInferido: tipoResiduoInferido,
              mensaje: mensajeContaminacion,
            },
          });
        }
      }
    }
  }
}
