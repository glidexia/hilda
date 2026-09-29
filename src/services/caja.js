const prisma = require("../db");
const { calcularCaja, dinero } = require("../utils/caja");

function armarCaja(camion, fecha, cierre, pedidos) {
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

  return armarCaja(camion, fecha, cierre, pedidos);
}

async function obtenerCajasRango(desde, hasta, { incluirVacios = false } = {}) {
  const [camiones, cierres, pedidos] = await Promise.all([
    prisma.camion.findMany({ include: { chofer: true }, orderBy: { nombre: "asc" } }),
    prisma.cierreCaja.findMany({
      where: { fecha: { gte: desde, lte: hasta } },
      include: { extracciones: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.pedido.findMany({
      where: { fechaEntrega: { gte: desde, lte: hasta } },
      include: { items: { include: { producto: true } } },
    }),
  ]);
  const cierresPorClave = new Map(cierres.map((cierre) => [`${cierre.camionId}|${cierre.fecha.toISOString().slice(0, 10)}`, cierre]));
  const pedidosPorClave = new Map();
  for (const pedido of pedidos) {
    const clave = `${pedido.camionId}|${pedido.fechaEntrega.toISOString().slice(0, 10)}`;
    if (!pedidosPorClave.has(clave)) pedidosPorClave.set(clave, []);
    pedidosPorClave.get(clave).push(pedido);
  }

  const cajas = [];
  for (let fecha = new Date(desde); fecha.getTime() <= hasta.getTime(); fecha.setUTCDate(fecha.getUTCDate() + 1)) {
    const copiaFecha = new Date(fecha);
    const iso = copiaFecha.toISOString().slice(0, 10);
    for (const camion of camiones) {
      const clave = `${camion.id}|${iso}`;
      const cierre = cierresPorClave.get(clave) || null;
      const pedidosDia = pedidosPorClave.get(clave) || [];
      if (!incluirVacios && !cierre && !pedidosDia.length) continue;
      cajas.push(armarCaja(camion, copiaFecha, cierre, pedidosDia));
    }
  }
  return cajas.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.camion.nombre.localeCompare(b.camion.nombre));
}

module.exports = { obtenerCaja, obtenerCajasRango, armarCaja };
