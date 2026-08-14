const prisma = require("../db");
const { asignarCamionPorBarrio } = require("../utils/zona");
const { proximoDiaHabil } = require("../utils/diaHabil");
const { emitPedidoCreado } = require("../events");

// GET /public/productos?categoria=hogar|oficina_revendedor
async function listarProductos(req, res) {
  const { categoria } = req.query;
  const where = { activo: true };
  if (categoria) where.categoria = categoria;
  const productos = await prisma.producto.findMany({ where, orderBy: { id: "asc" } });
  res.json(productos);
}

// Lista de barrios disponibles para el <select> del formulario de pedido
async function listarZonas(req, res) {
  const zonas = await prisma.zona.findMany({ include: { camion: true }, orderBy: { barrio: "asc" } });
  res.json(zonas.map((z) => ({ barrio: z.barrio, camionId: z.camionId, camionNombre: z.camion.nombre })));
}

async function crearPedido(req, res) {
  const { nombre, telefono, barrio, calle, tipo, segmento, pago, items } = req.body;

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

  const fechaEntrega = await proximoDiaHabil(); // nunca cae sábado ni domingo

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
      segmento: segmento || "hogar",
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

// POST /public/area-privada/verificar   body: { clave }
// No expone la clave real — solo confirma si coincide, para el candado previo al login de admin/chofer.
async function verificarAreaPrivada(req, res) {
  const { clave } = req.body;
  const config = await prisma.configuracion.findUnique({ where: { id: 1 } });
  const claveGuardada = config?.claveAreaPrivada || "";

  // Si el admin todavía no configuró ninguna clave, se deja pasar (comportamiento inicial, como antes)
  if (!claveGuardada) return res.json({ ok: true });

  res.json({ ok: clave === claveGuardada });
}

module.exports = { listarProductos, listarZonas, crearPedido, verificarAreaPrivada };
