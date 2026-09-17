const prisma = require("../db");
const { calcularCaja, dinero } = require("../utils/caja");

async function obtenerCaja(camionId, fecha) {
  const [camion, cierre, pedidos] = await Promise.all([
    prisma.camion.findUnique({ where: { id: camionId }, include: { chofer: true } }),
    prisma.cierreCaja.findUnique({
      where: { camionId_fecha: { camionId, fecha } },
      include: { extracciones: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.pedido.findMany({
      where: { camionId, fechaEntrega: fecha },
      include: { items: { include: { producto: true } } },
    }),
  ]);

  if (!camion) return null;
  const extracciones = cierre?.extracciones || [];
  const calculada = calcularCaja(pedidos, extracciones);
  const resumen = cierre?.cerrado
    ? {
        pedidosEntregados: cierre.pedidosEntregados,
        ventasTotal: Number(cierre.ventasTotal),
        efectivoCobrado: Number(cierre.efectivoCobrado),
        transferenciasCobradas: Number(cierre.transferenciasCobradas),
        pendienteCobro: Number(cierre.pendienteCobro),
        extraccionesTotal: calculada.extraccionesTotal,
        efectivoEsperado: dinero(Number(cierre.efectivoCobrado) - calculada.extraccionesTotal),
        productos: Array.isArray(cierre.productosResumen) ? cierre.productosResumen : [],
      }
    : calculada;

  const efectivoDeclarado = cierre?.efectivoDeclarado == null ? null : Number(cierre.efectivoDeclarado);
  return {
    id: cierre?.id || null,
    fecha: fecha.toISOString().slice(0, 10),
    cerrado: Boolean(cierre?.cerrado),
    cerradoAt: cierre?.cerradoAt || null,
    camion: { id: camion.id, nombre: camion.nombre, color: camion.color },
    choferNombre: cierre?.choferNombre || camion.chofer?.nombre || "",
    observaciones: cierre?.observaciones || "",
    efectivoDeclarado,
    diferencia: efectivoDeclarado == null ? null : dinero(efectivoDeclarado - resumen.efectivoEsperado),
    extracciones: extracciones.map((extraccion) => ({
      id: extraccion.id,
      monto: Number(extraccion.monto),
      concepto: extraccion.concepto,
      responsable: extraccion.responsable,
      createdAt: extraccion.createdAt,
    })),
    ...resumen,
  };
}

module.exports = { obtenerCaja };
