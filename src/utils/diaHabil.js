const prisma = require("../db");

// Devuelve la próxima fecha (desde mañana) que NO esté marcada como día no hábil
// en la tabla "dias_no_habiles". El admin es quien carga esos días (domingos, feriados, etc.)
// desde su panel — acá no se asume ninguna regla fija de antemano.
async function proximoDiaHabil(desde = new Date()) {
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() + 1);

  for (let intento = 0; intento < 30; intento++) {
    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(fecha);
    finDia.setHours(23, 59, 59, 999);

    const marcado = await prisma.diaNoHabil.findFirst({
      where: { fecha: { gte: inicioDia, lte: finDia } },
    });

    if (!marcado) return inicioDia;
    fecha.setDate(fecha.getDate() + 1);
  }

  return fecha; // margen de seguridad por si el calendario tiene 30 días seguidos marcados (no debería pasar)
}

module.exports = { proximoDiaHabil };
