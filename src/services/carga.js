const prisma = require("../db");
const { resumirCarga } = require("../utils/carga");

async function obtenerCargasDia(fecha, camionId = null) {
  const camiones = await prisma.camion.findMany({
    where: camionId ? { id: camionId } : { activo: true },
    include: {
      chofer: true,
      pedidos: {
        where: { fechaEntrega: fecha },
        include: { items: { include: { producto: true } } },
      },
    },
    orderBy: { nombre: "asc" },
  });

  return camiones.map((camion) => ({
    fecha: fecha.toISOString().slice(0, 10),
    camion: { id: camion.id, nombre: camion.nombre, color: camion.color },
    chofer: camion.chofer ? { id: camion.chofer.id, nombre: camion.chofer.nombre } : null,
    ...resumirCarga(camion.pedidos),
  }));
}

module.exports = { obtenerCargasDia };
