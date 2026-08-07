const prisma = require("../db");
const { resolverFecha } = require("../utils/fechas");
const { ordenarPorRuta } = require("../utils/ruta");
const { emitPedidoActualizado } = require("../events");

// GET /chofer/pedidos?dia=ayer|hoy|manana
async function listarMisPedidos(req, res) {
  const camionId = req.user.camionId;
  const fecha = resolverFecha(req.query.dia);

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
      pago: p.pago,
      estado: p.estado,
      productos: p.items.map((it) => `${it.cantidad}× ${it.producto.nombre}`),
    }))
  );
}

// PATCH /chofer/pedidos/:id/estado   body: { estado: "entregado" | "no_atendido" | "pendiente" }
async function marcarEstado(req, res) {
  const camionId = req.user.camionId;
  const pedidoId = Number(req.params.id);
  const { estado } = req.body;

  if (!["entregado", "no_atendido", "pendiente"].includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.camionId !== camionId) {
    return res.status(404).json({ error: "Ese pedido no pertenece a tu camión" });
  }

  const actualizado = await prisma.pedido.update({ where: { id: pedidoId }, data: { estado } });
  emitPedidoActualizado(actualizado);

  res.json({ id: actualizado.id, estado: actualizado.estado });
}

module.exports = { listarMisPedidos, marcarEstado };
