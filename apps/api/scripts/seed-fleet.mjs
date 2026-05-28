import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Sembrando camiones por defecto...");

  const camiones = [
    {
      placa: "TRK-001",
      capacidad: "1000kg",
      capacidadMax: 1000,
      capacidadDisponible: 1000,
      estado: "Disponible",
      latitud: 25.532500,
      longitud: -103.435000,
      tipoResiduos: "Orgánicos,Reciclables",
    },
    {
      placa: "TRK-002",
      capacidad: "1500kg",
      capacidadMax: 1500,
      capacidadDisponible: 1500,
      estado: "Disponible",
      latitud: 25.534000,
      longitud: -103.437000,
      tipoResiduos: "Inorgánicos,Residuos especiales",
    },
  ];

  for (const c of camiones) {
    const existing = await prisma.camion.findFirst({
      where: { placa: c.placa },
    });

    if (existing) {
      await prisma.camion.update({
        where: { idCamion: existing.idCamion },
        data: c,
      });
    } else {
      await prisma.camion.create({
        data: c,
      });
    }
  }

  console.log("Actualizando tipos de residuo de contenedores existentes...");
  const types = {
    1: "Orgánicos",
    2: "Reciclables",
    3: "Inorgánicos",
  };

  for (const [id, type] of Object.entries(types)) {
    await prisma.contenedor.updateMany({
      where: { idContenedor: parseInt(id) },
      data: { tipoResiduo: type },
    });
  }

  console.log("Siembra finalizada con éxito.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
