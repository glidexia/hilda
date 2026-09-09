const prisma = require("../db");
const { resolverFecha, sePuedeModificarPedido } = require("../utils/fechas");
const { ordenarPorRuta } = require("../utils/ruta");
const { emitPedidoActualizado } = require("../events");
const { esPagoValido, validarComprobantePago } = require("../constants/pagos");
const { nuevaClave, guardarArchivo, borrarArchivo } = require("../services/archivos");

// GET /chofer/pedidos?dia=ayer|hoy|manana
async function listarMisPedidos(req, res) {
  const camionId = req.user.camionId;
  const fecha = resolverFecha(req.query.dia);
  if (!fecha) return res.status(400).json({ error: "Dia invalido. Usa ayer, hoy, manana o una fecha AAAA-MM-DD" });

  const [pedidos, zonas] = await Promise.all([
    prisma.pedido.findMany({
      where: { camionId, fechaEntrega: fecha },
      include: { cliente: true, items: { include: { producto: true } } },
    }),
    prisma.zona.findMany({ where: { camionId } }),
  ]);

  const ordenPorBarrio = Object.fromEntries(zonas.map((z) => [z.barrio, z.orden]));
  const ordenados = ordenarPorRuta(pedidos, ordenPorBarrio);

  res.json(
    ordenados.map((p, i) => ({
      parada: i + 1,
      id: p.id,
      cliente: p.cliente.nombre,
      telefono: p.cliente.telefono,
      direccion: p.direccion,
      barrio: p.barrio,
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
      productos: p.items.map((it) => `${it.cantidad}× ${it.producto?.nombre || it.productoNombre}`),
    }))
  );
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

module.exports = { listarMisPedidos, marcarEstado, registrarCobro, guardarNotaCamion };
