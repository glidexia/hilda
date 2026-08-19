const prisma = require("../db");
const { resolverFecha, sePuedeModificarPedido } = require("../utils/fechas");
const { ordenarPorRuta } = require("../utils/ruta");
const { emitPedidoActualizado } = require("../events");

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
      total: p.total,
      productos: p.items.map((it) => `${it.cantidad}× ${it.producto?.nombre || it.productoNombre}`),
    }))
  );
}

// PATCH /chofer/pedidos/:id/estado
// body: { estado: "entregado" | "no_atendido" | "pendiente", pagoConfirmado?: "Efectivo" | "Transferencia" | ... }
// pagoConfirmado solo tiene sentido cuando estado === "entregado" — es cómo pagó realmente, según confirma el chofer.
async function marcarEstado(req, res) {
  const camionId = req.user.camionId;
  const pedidoId = Number(req.params.id);
  const { estado, pagoConfirmado } = req.body;

  if (!["entregado", "no_atendido", "pendiente"].includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.camionId !== camionId) {
    return res.status(404).json({ error: "Ese pedido no pertenece a tu camión" });
  }

  if (!sePuedeModificarPedido(pedido.fechaEntrega)) {
    return res.status(409).json({ error: "Este pedido todavia no se puede marcar porque esta programado para una fecha futura" });
  }

  const data = { estado };
  if (estado === "entregado" && pagoConfirmado) data.pagoConfirmado = pagoConfirmado;
  if (estado !== "entregado") data.pagoConfirmado = null; // si se revierte, se limpia la confirmación

  const actualizado = await prisma.pedido.update({ where: { id: pedidoId }, data });
  emitPedidoActualizado(actualizado);

  res.json({ id: actualizado.id, estado: actualizado.estado, pagoConfirmado: actualizado.pagoConfirmado });
}

module.exports = { listarMisPedidos, marcarEstado };
