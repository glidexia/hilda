const prisma = require("../db");

// Cada barrio está mapeado a un único camión en la tabla "zonas" (ver prisma/schema.prisma).
// Esto reemplaza la asignación automática que hacíamos en el mockup con datos de mentira.
async function asignarCamionPorBarrio(barrio) {
  const zona = await prisma.zona.findUnique({
    where: { barrio },
    include: { camion: true },
  });
  return zona ? zona.camion : null;
}

module.exports = { asignarCamionPorBarrio };
