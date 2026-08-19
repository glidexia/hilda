const prisma = require("../db");
const { hoy, inicioDelDia, sumarDias } = require("./fechas");

// Devuelve la proxima fecha, desde manana, que no sea fin de semana
// ni figure como dia no habil en la configuracion.
async function proximoDiaHabil(desde = new Date()) {
  let fecha = sumarDias(inicioDelDia(desde) || hoy(), 1);

  for (let intento = 0; intento < 30; intento++) {
    const diaSemana = fecha.getUTCDay();
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

    if (!esFinDeSemana) {
      const marcado = await prisma.diaNoHabil.findUnique({ where: { fecha } });
      if (!marcado) return fecha;
    }
    fecha = sumarDias(fecha, 1);
  }

  return fecha;
}

module.exports = { proximoDiaHabil };
