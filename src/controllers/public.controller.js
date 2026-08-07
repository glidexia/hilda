const prisma = require("../db");
const { asignarCamionPorBarrio } = require("../utils/zona");
const { proximoDiaHabil } = require("../utils/diaHabil");
const { emitPedidoCreado } = require("../events");

async function listarProductos(req, res) {
  const productos = await prisma.producto.findMany({ where: { activo: true }, orderBy: { id: "asc" } });
  res.json(productos);
}

// Lista de barrios disponibles para el <select> del formulario de pedido
async function listarZonas(req, res) {
  const zonas = await prisma.zona.findMany({ include: { camion: true }, orderBy: { barrio: "asc" } });
  res.json(zonas.map((z) => ({ barrio: z.barrio, camionId: z.camionId, camionNombre: z.camion.nombre })));
}

async function crearPedido(req, res) {
  const { nombre, telefono, barrio, calle, tipo, pago, items } = req.body;

  if (!nombre || !telefono || !barrio || !calle || !items || items.length === 0) {
    return res.status(400).json({ error: "Faltan datos del pedido" });
  }

  const camion = await asignarCamionPorBarrio(barrio);
  if (!camion) {
    return res.status(422).json({ error: "Todavía no cubrimos esa zona. Contactanos directamente para coordinar." });
  }

  const productos = await prisma.producto.findMany({ where: { id: { in: items.map((i) => i.productoId) } } });
  if (productos.length !== items.length) {
    return res.status(400).json({ error: "Algún producto del pedido ya no existe o está desactivado" });
  }

  const total = items.reduce((suma, i) => {
    const p = productos.find((p) => p.id === i.productoId);
    return suma + Number(p.precio) * i.cantidad;
  }, 0);

  const fechaEntrega = await proximoDiaHabil();

  const cliente = await prisma.cliente.create({
    data: { nombre, telefono, barrio, calle, tipo: tipo || "casa", pago },
  });

  const pedido = await prisma.pedido.create({
    data: {
      clienteId: cliente.id,
      camionId: camion.id,
      direccion: calle,
      barrio,
      tipo: tipo || "casa",
      pago,
      fechaEntrega,
      total,
      items: {
        create: items.map((i) => {
          const p = productos.find((p) => p.id === i.productoId);
          return { productoId: i.productoId, cantidad: i.cantidad, precioUnitario: p.precio };
        }),
      },
    },
    include: { items: true, camion: true },
  });

  emitPedidoCreado(pedido);

  res.status(201).json({
    pedidoId: pedido.id,
    camion: pedido.camion.nombre,
    fechaEntrega: pedido.fechaEntrega,
    total: pedido.total,
  });
}

module.exports = { listarProductos, listarZonas, crearPedido };
