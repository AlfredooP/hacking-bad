import { prisma } from "../../lib/prisma.js";

export async function listTrucks() {
  const trucks = await prisma.camion.findMany();
  return trucks.map((t) => ({
    id: t.idCamion,
    placa: t.placa,
    capacidad: t.capacidad,
    capacidadMax: t.capacidadMax,
    capacidadDisponible: t.capacidadDisponible,
    estado: t.estado,
    latitud: t.latitud ? Number(t.latitud) : null,
    longitud: t.longitud ? Number(t.longitud) : null,
    tipoResiduos: t.tipoResiduos,
  }));
}

export async function createTruck(data: {
  placa: string;
  capacidad: string;
  capacidadMax?: number;
  capacidadDisponible?: number;
  estado: string;
  latitud?: number;
  longitud?: number;
  tipoResiduos: string;
}) {
  return prisma.camion.create({
    data: {
      placa: data.placa,
      capacidad: data.capacidad,
      capacidadMax: data.capacidadMax ?? 1000,
      capacidadDisponible: data.capacidadDisponible ?? data.capacidadMax ?? 1000,
      estado: data.estado,
      latitud: data.latitud ?? null,
      longitud: data.longitud ?? null,
      tipoResiduos: data.tipoResiduos,
    },
  });
}

export async function updateTruck(
  id: number,
  data: {
    placa?: string;
    capacidad?: string;
    capacidadMax?: number;
    capacidadDisponible?: number;
    estado?: string;
    latitud?: number;
    longitud?: number;
    tipoResiduos?: string;
  }
) {
  return prisma.camion.update({
    where: { idCamion: id },
    data: {
      placa: data.placa,
      capacidad: data.capacidad,
      capacidadMax: data.capacidadMax,
      capacidadDisponible: data.capacidadDisponible,
      estado: data.estado,
      latitud: data.latitud,
      longitud: data.longitud,
      tipoResiduos: data.tipoResiduos,
    },
  });
}

export async function deleteTruck(id: number) {
  return prisma.camion.delete({
    where: { idCamion: id },
  });
}
