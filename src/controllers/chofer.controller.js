const prisma = require("../db");
const { resolverFecha, sePuedeModificarPedido } = require("../utils/fechas");
const { ordenarPorRuta } = require("../utils/ruta");
const { emitPedidoActualizado } = require("../events");
const { esPagoValido, validarComprobantePago } = require("../constants/pagos");
const { nuevaClave, guardarArchivo, borrarArchivo } = require("../services/archivos");
const { asegurarCoordenadasPedidos, coordenadasValidas } = require("../services/geocodificacion");
const { obtenerCaja } = require("../services/caja");
const { hoy } = require("../utils/fechas");
const { obtenerCargasDia } = require("../services/carga");

// GET /chofer/pedidos?dia=ayer|hoy|manana
async function listarMisPedidos(req, res) {
  const camionId = req.user.camionId;
  const fecha = resolverFecha(req.query.dia);
  if (!fecha) return res.status(400).json({ error: "Dia invalido. Usa ayer, hoy, manana o una fecha AAAA-MM-DD" });

  const [pedidos, zonas, configuracion] = await Promise.all([
    prisma.pedido.findMany({
      where: { camionId, fechaEntrega: fecha },
      include: { cliente: true, items: { include: { producto: true } } },
    }),
    prisma.zona.findMany({ where: { camionId } }),
    prisma.configuracion.findUnique({ where: { id: 1 } }),
  ]);

  const ordenPorBarrio = Object.fromEntries(zonas.map((z) => [z.barrio, z.orden]));
  const origen = configuracion ? { latitud: configuracion.latitudBase, longitud: configuracion.longitudBase } : null;
  if (coordenadasValidas(origen)) await asegurarCoordenadasPedidos(pedidos);
  const ordenados = ordenarPorRuta(pedidos, ordenPorBarrio, origen);

  res.json(
    ordenados.map((p, i) => ({
      parada: i + 1,
      id: p.id,
      cliente: p.cliente.nombre,
      telefono: p.cliente.telefono,
      direccion: p.direccion,
      barrio: p.barrio,
      latitud: p.latitud,
      longitud: p.longitud,
      pago: p.pago, // lo que el cliente declaró al pedir
      pagoConfirmado: p.pagoConfirmado, // lo que el chofer confirmó al entregar (si ya lo hizo)
      estado: p.estado,
      fechaEntrega: p.fechaEntrega,
      fechaEntregaOriginal: p.fechaEntregaOriginal,
      fechaReasignadaManual: p.fechaReasignadaManual,
      horaDesde: p.horaDesde,
      horaHasta: p.horaHasta,
      notas: p.notas,
      notaAdmin: p.notaAdmin,
      notaCamion: p.notaCamion,
      tieneComprobante: Boolean(p.comprobanteKey),
      total: p.total,
      items: p.items.map((it) => ({
        id: it.id,
        productoId: it.productoId,
        nombre: it.producto?.nombre || it.productoNombre,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
      })),
      productos: p.items.map((it) => `${it.cantidad}× ${it.producto?.nombre || it.productoNombre}`),
    }))
  );
}

// GET /chofer/carga?fecha=AAAA-MM-DD — mercadería programada y todavía pendiente.
async function verCarga(req, res) {
  const fecha = resolverFecha(req.query.fecha || req.query.dia || "hoy");
  if (!fecha) return res.status(400).json({ error: "Fecha inválida" });
  const [carga] = await obtenerCargasDia(fecha, req.user.camionId);
  if (!carga) return res.status(404).json({ error: "No encontramos tu camión" });
  res.json(carga);
}

// PATCH /chofer/pedidos/:id/estado
// body: { estado: "entregado" | "no_atendido" | "pendiente", pagoConfirmado?: "Efectivo" | "Transferencia" | ... }
// La entrega puede registrarse sin cobro. El pago real también se puede cargar después.
async function marcarEstado(req, res) {
  const camionId = req.user.camionId;
  const pedidoId = Number(req.params.id);
  const { estado, pagoConfirmado } = req.body;

  if (!["entregado", "no_atendido", "pendiente"].includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }
  const pagoInformado = pagoConfirmado !== undefined && pagoConfirmado !== null && pagoConfirmado !== "";
  if (estado === "entregado" && pagoInformado && !esPagoValido(pagoConfirmado)) {
    return res.status(400).json({ error: "Confirmá si cobraste en Efectivo o por Transferencia" });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.camionId !== camionId) {
    return res.status(404).json({ error: "Ese pedido no pertenece a tu camión" });
  }

  if (!sePuedeModificarPedido(pedido.fechaEntrega)) {
    return res.status(409).json({ error: "Este pedido todavia no se puede marcar porque esta programado para una fecha futura" });
  }

  const data = { estado };
  if (estado === "entregado") data.pagoConfirmado = pagoInformado ? pagoConfirmado : null;
  if (estado !== "entregado") data.pagoConfirmado = null; // si se revierte, se limpia la confirmación

  const actualizado = await prisma.pedido.update({ where: { id: pedidoId }, data });
  emitPedidoActualizado(actualizado);

  res.json({ id: actualizado.id, estado: actualizado.estado, pagoConfirmado: actualizado.pagoConfirmado });
}

// PATCH /chofer/pedidos/:id/cobro (multipart)
// El cobro puede registrarse al entregar o posteriormente, incluso si el pedido fue de ayer.
async function registrarCobro(req, res) {
  const camionId = req.user.camionId;
  const pedidoId = Number(req.params.id);
  const pagoConfirmado = String(req.body?.pagoConfirmado || "");
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return res.status(400).json({ error: "Pedido inválido" });
  if (!esPagoValido(pagoConfirmado)) return res.status(400).json({ error: "Elegí Efectivo o Transferencia" });

  const errorComprobante = validarComprobantePago(pagoConfirmado, Boolean(req.file));
  if (errorComprobante) return res.status(400).json({ error: errorComprobante });

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.camionId !== camionId) return res.status(404).json({ error: "Ese pedido no pertenece a tu camión" });
  if (pedido.estado === "no_atendido") return res.status(409).json({ error: "Primero marcá el pedido como entregado" });
  if (pedido.estado === "pendiente" && !sePuedeModificarPedido(pedido.fechaEntrega)) {
    return res.status(409).json({ error: "Este pedido está programado para una fecha futura" });
  }

  let comprobanteNuevo = null;
  let actualizado;
  try {
    if (req.file) {
      comprobanteNuevo = nuevaClave("comprobantes", req.file.mimetype);
      await guardarArchivo({ key: comprobanteNuevo, buffer: req.file.buffer, mime: req.file.mimetype });
    }

    const conservarComprobante = pagoConfirmado === "Transferencia";
    actualizado = await prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: "entregado",
        pagoConfirmado,
        comprobanteKey: conservarComprobante ? (comprobanteNuevo || pedido.comprobanteKey) : null,
        comprobanteMime: conservarComprobante ? (req.file?.mimetype || pedido.comprobanteMime) : null,
        comprobanteFecha: conservarComprobante ? (req.file ? new Date() : pedido.comprobanteFecha) : null,
      },
    });

  } catch (error) {
    if (comprobanteNuevo) await borrarArchivo(comprobanteNuevo).catch(() => {});
    throw error;
  }

  const reemplazoOEliminoComprobante = comprobanteNuevo || pagoConfirmado !== "Transferencia";
  if (pedido.comprobanteKey && reemplazoOEliminoComprobante) await borrarArchivo(pedido.comprobanteKey).catch(() => {});
  emitPedidoActualizado(actualizado);
  res.json({
    id: actualizado.id,
    estado: actualizado.estado,
    pagoConfirmado: actualizado.pagoConfirmado,
    tieneComprobante: Boolean(actualizado.comprobanteKey),
  });
}

// PATCH /chofer/pedidos/:id/nota
async function guardarNotaCamion(req, res) {
  const camionId = req.user.camionId;
  const pedidoId = Number(req.params.id);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return res.status(400).json({ error: "Pedido inválido" });

  const notaCamion = typeof req.body?.notaCamion === "string" ? req.body.notaCamion.trim() : "";
  if (notaCamion.length > 500) return res.status(400).json({ error: "La nota del camión puede tener hasta 500 caracteres" });

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.camionId !== camionId) return res.status(404).json({ error: "Ese pedido no pertenece a tu camión" });

  const actualizado = await prisma.pedido.update({ where: { id: pedidoId }, data: { notaCamion } });
  emitPedidoActualizado(actualizado);
  res.json({ id: actualizado.id, notaCamion: actualizado.notaCamion });
}

// PATCH /chofer/pedidos/:id/items
// Permite registrar los productos y cantidades que efectivamente se dejaron.
// Un producto activo puede agregarse aunque no estuviera en el pedido original.
async function actualizarItemsPedido(req, res) {
  const camionId = req.user.camionId;
  const pedidoId = Number(req.params.id);
  const items = req.body?.items;
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return res.status(400).json({ error: "Pedido inválido" });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Indicá las cantidades entregadas" });
  if (!items.every((item) => Number.isInteger(item.cantidad) && item.cantidad > 0 && item.cantidad <= 999 && (
    Number.isInteger(item.productoId) || Number.isInteger(item.itemId) || Number.isInteger(item.id)
  ))) {
    return res.status(400).json({ error: "Revisá las cantidades entregadas" });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { items: true } });
  if (!pedido || pedido.camionId !== camionId) return res.status(404).json({ error: "Ese pedido no pertenece a tu camión" });
  if (pedido.estado === "no_atendido") return res.status(409).json({ error: "Reagendá o revertí el pedido antes de modificar cantidades" });
  if (!sePuedeModificarPedido(pedido.fechaEntrega)) return res.status(409).json({ error: "Las cantidades se modifican el día de la entrega" });

  const itemsActualesPorId = new Map(pedido.items.map((item) => [item.id, item]));
  const itemsActualesPorProducto = new Map(pedido.items.filter((item) => item.productoId).map((item) => [item.productoId, item]));
  const normalizados = [];
  for (const item of items) {
    if (Number.isInteger(item.productoId)) {
      normalizados.push({ productoId: item.productoId, cantidad: item.cantidad });
      continue;
    }
    const itemActual = itemsActualesPorId.get(item.itemId ?? item.id);
    if (!itemActual) return res.status(400).json({ error: "Uno de los productos ya no coincide con el pedido" });
    normalizados.push({ productoId: itemActual.productoId, itemActual, cantidad: item.cantidad });
  }

  const claves = normalizados.map((item) => item.productoId ? `producto-${item.productoId}` : `item-${item.itemActual.id}`);
  if (new Set(claves).size !== claves.length) return res.status(400).json({ error: "Hay productos repetidos" });

  const idsProductos = normalizados.filter((item) => item.productoId).map((item) => item.productoId);
  const productos = await prisma.producto.findMany({ where: { id: { in: idsProductos } } });
  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));
  const preparados = [];
  for (const item of normalizados) {
    if (!item.productoId) {
      preparados.push({
        id: item.itemActual.id,
        productoId: null,
        productoNombre: item.itemActual.productoNombre,
        cantidad: item.cantidad,
        precioUnitario: item.itemActual.precioUnitario,
      });
      continue;
    }
    const producto = productosPorId.get(item.productoId);
    const anterior = itemsActualesPorProducto.get(item.productoId);
    if (!producto) return res.status(400).json({ error: "Uno de los productos ya no existe" });
    if (!producto.activo && !anterior) return res.status(409).json({ error: `${producto.nombre} está oculto y no se puede agregar` });
    preparados.push({
      id: anterior?.id,
      productoId: producto.id,
      productoNombre: producto.nombre,
      cantidad: item.cantidad,
      precioUnitario: anterior?.precioUnitario ?? producto.precio,
    });
  }

  const total = preparados.reduce((suma, item) => suma + Number(item.precioUnitario) * item.cantidad, 0);
  const actualizado = await prisma.$transaction(async (tx) => {
    const idsConservados = preparados.filter((item) => item.id).map((item) => item.id);
    await tx.pedidoItem.deleteMany({ where: { pedidoId, ...(idsConservados.length ? { id: { notIn: idsConservados } } : {}) } });
    for (const item of preparados) {
      if (item.id) {
        await tx.pedidoItem.update({ where: { id: item.id }, data: { cantidad: item.cantidad } });
      } else {
        await tx.pedidoItem.create({
          data: {
            pedidoId,
            productoId: item.productoId,
            productoNombre: item.productoNombre,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          },
        });
      }
    }
    return tx.pedido.update({
      where: { id: pedidoId },
      data: { total },
      include: { items: { include: { producto: true } } },
    });
  });

  emitPedidoActualizado(actualizado);
  res.json({
    id: actualizado.id,
    total: actualizado.total,
    items: actualizado.items.map((item) => ({ id: item.id, productoId: item.productoId, cantidad: item.cantidad, nombre: item.producto?.nombre || item.productoNombre, precioUnitario: item.precioUnitario })),
    productos: actualizado.items.map((item) => `${item.cantidad}× ${item.producto?.nombre || item.productoNombre}`),
  });
}

function fechaCajaDesdeRequest(req, res) {
  const fecha = resolverFecha(req.query?.fecha || req.body?.fecha || req.query?.dia);
  if (!fecha) {
    res.status(400).json({ error: "Fecha inválida" });
    return null;
  }
  if (fecha.getTime() > hoy().getTime()) {
    res.status(400).json({ error: "La caja se puede consultar o cerrar desde el día del reparto" });
    return null;
  }
  return fecha;
}

// GET /chofer/caja?fecha=AAAA-MM-DD
async function verCaja(req, res) {
  const fecha = fechaCajaDesdeRequest(req, res);
  if (!fecha) return;
  const caja = await obtenerCaja(req.user.camionId, fecha);
  if (!caja) return res.status(404).json({ error: "No encontramos tu camión" });
  res.json(caja);
}

// POST /chofer/caja/extracciones
async function agregarExtraccionCaja(req, res) {
  const fecha = fechaCajaDesdeRequest(req, res);
  if (!fecha) return;
  const monto = Number(req.body?.monto);
  const concepto = String(req.body?.concepto || "").trim();
  const responsable = String(req.body?.responsable || req.user.nombre || "").trim();
  if (!Number.isFinite(monto) || monto <= 0 || monto > 99999999) return res.status(400).json({ error: "Ingresá un monto válido" });
  if (!concepto || concepto.length > 120) return res.status(400).json({ error: "Indicá brevemente para qué se retiró el dinero" });
  if (!responsable || responsable.length > 80) return res.status(400).json({ error: "Indicá quién retiró el dinero" });

  const cierre = await prisma.cierreCaja.upsert({
    where: { camionId_fecha: { camionId: req.user.camionId, fecha } },
    create: { camionId: req.user.camionId, fecha, choferNombre: req.user.nombre || "" },
    update: {},
  });
  if (cierre.cerrado) return res.status(409).json({ error: "La caja ya está cerrada. Un administrador debe reabrirla para modificarla" });

  await prisma.extraccionCaja.create({ data: { cierreCajaId: cierre.id, monto, concepto, responsable } });
  res.status(201).json(await obtenerCaja(req.user.camionId, fecha));
}

// DELETE /chofer/caja/extracciones/:id
async function quitarExtraccionCaja(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Extracción inválida" });
  const extraccion = await prisma.extraccionCaja.findUnique({ where: { id }, include: { cierreCaja: true } });
  if (!extraccion || extraccion.cierreCaja.camionId !== req.user.camionId) return res.status(404).json({ error: "No encontramos esa extracción" });
  if (extraccion.cierreCaja.cerrado) return res.status(409).json({ error: "La caja ya está cerrada" });
  await prisma.extraccionCaja.delete({ where: { id } });
  res.json(await obtenerCaja(req.user.camionId, extraccion.cierreCaja.fecha));
}

// POST /chofer/caja/cerrar
async function cerrarCaja(req, res) {
  const fecha = fechaCajaDesdeRequest(req, res);
  if (!fecha) return;
  const efectivoDeclarado = Number(req.body?.efectivoDeclarado);
  const observaciones = String(req.body?.observaciones || "").trim();
  if (!Number.isFinite(efectivoDeclarado) || efectivoDeclarado < 0 || efectivoDeclarado > 999999999) {
    return res.status(400).json({ error: "Ingresá el efectivo que vas a rendir" });
  }
  if (observaciones.length > 500) return res.status(400).json({ error: "Las observaciones pueden tener hasta 500 caracteres" });

  const cierre = await prisma.cierreCaja.upsert({
    where: { camionId_fecha: { camionId: req.user.camionId, fecha } },
    create: { camionId: req.user.camionId, fecha, choferNombre: req.user.nombre || "" },
    update: {},
  });
  if (cierre.cerrado) return res.status(409).json({ error: "Esta caja ya fue cerrada" });

  const actual = await obtenerCaja(req.user.camionId, fecha);
  const resultado = await prisma.cierreCaja.updateMany({
    where: { id: cierre.id, cerrado: false },
    data: {
      cerrado: true,
      choferNombre: req.user.nombre || actual.choferNombre,
      pedidosEntregados: actual.pedidosEntregados,
      ventasTotal: actual.ventasTotal,
      efectivoCobrado: actual.efectivoCobrado,
      transferenciasCobradas: actual.transferenciasCobradas,
      pendienteCobro: actual.pendienteCobro,
      productosResumen: actual.productos,
      efectivoDeclarado,
      observaciones,
      cerradoAt: new Date(),
    },
  });
  if (!resultado.count) return res.status(409).json({ error: "La caja acaba de ser cerrada desde otra sesión" });
  res.json(await obtenerCaja(req.user.camionId, fecha));
}

module.exports = {
  listarMisPedidos,
  marcarEstado,
  registrarCobro,
  guardarNotaCamion,
  actualizarItemsPedido,
  verCaja,
  agregarExtraccionCaja,
  quitarExtraccionCaja,
  cerrarCaja,
  verCarga,
};
