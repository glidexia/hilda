const prisma = require("../db");

// Devuelve la próxima fecha (desde mañana) que:
//   1) NO sea sábado ni domingo (regla fija, siempre activa — no depende de configuración), y
//   2) NO esté marcada como feriado/día excepcional en "dias_no_habiles".
// Ejemplo: pedido hecho un viernes, sábado o domingo → se entrega el lunes siguiente.
async function proximoDiaHabil(desde = new Date()) {
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() + 1);

  for (let intento = 0; intento < 30; intento++) {
    const diaSemana = fecha.getDay(); // 0 = domingo, 6 = sábado
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

    if (!esFinDeSemana) {
      const inicioDia = new Date(fecha);
      inicioDia.setHours(0, 0, 0, 0);
      const finDia = new Date(fecha);
      finDia.setHours(23, 59, 59, 999);

      const marcado = await prisma.diaNoHabil.findFirst({
        where: { fecha: { gte: inicioDia, lte: finDia } },
      });

      if (!marcado) return inicioDia;
    }
    fecha.setDate(fecha.getDate() + 1);
  }

  return fecha; // margen de seguridad, no debería llegar acá nunca
}

module.exports = { proximoDiaHabil };
