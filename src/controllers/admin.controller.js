const prisma = require("../db");
const { resolverFecha } = require("../utils/fechas");
const { ordenarPorRuta } = require("../utils/ruta");
const { emitPedidoActualizado, emitCamionActualizado, emitProductoActualizado } = require("../events");

/* ---------------------------- PEDIDOS ---------------------------- */

// GET /admin/pedidos?dia=hoy&camionId=&estado=&q=
async function listarPedidos(req, res) {
  const { dia, camionId, estado, q } = req.query;

  const where = {};
  if (dia) where.fechaEntrega = resolverFecha(dia);
  if (camionId) where.camionId = Number(camionId);
  if (estado) where.estado = estado;
  if (q) where.cliente = { nombre: { contains: q, mode: "insensitive" } };

  const [pedidos, camiones, zonas] = await Promise.all([
    prisma.pedido.findMany({ where, include: { cliente: true, camion: true } }),
    prisma.camion.findMany(),
    prisma.zona.findMany(),
  ]);

  // Agrupa por camión y ordena cada grupo como hoja de ruta — igual que en el mockup
  const zonasPorCamion = {};
  for (const z of zonas) {
    zonasPorCamion[z.camionId] = zonasPorCamion[z.camionId] || {};
    zonasPorCamion[z.camionId][z.barrio] = z.orden;
  }

  const grupos = camiones
    .map((cm) => {
      const items = pedidos.filter((p) => p.camionId === cm.id);
      const ordenados = ordenarPorRuta(items, zonasPorCamion[cm.id] || {});
      return {
        camion: { id: cm.id, nombre: cm.nombre, color: cm.color },
        pedidos: ordenados.map((p, i) => ({
          parada: i + 1,
          id: p.id,
          cliente: p.cliente.nombre,
          barrio: p.barrio,
          fechaEntrega: p.fechaEntrega,
          estado: p.estado,
          camionId: p.camionId,
          reasignadoManual: p.reasignadoManual,
        })),
      };
    })
    .filter((g) => g.pedidos.length > 0);

  res.json(grupos);
}

// PATCH /admin/pedidos/:id/camion   body: { camionId }
async function reasignarCamion(req, res) {
  const pedidoId = Number(req.params.id);
  const { camionId } = req.body;

  const existente = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!existente) return res.status(404).json({ error: "Pedido no encontrado" });

  const nuevoCamion = await prisma.camion.findUnique({ where: { id: camionId } });
  if (!nuevoCamion) return res.status(400).json({ error: "Ese camión no existe" });

  const actualizado = await prisma.pedido.update({
    where: { id: pedidoId },
    data: { camionId, reasignadoManual: camionId !== existente.camionId },
  });

  emitPedidoActualizado(actualizado, existente.camionId);
  res.json(actualizado);
}

/* ---------------------------- CLIENTES ---------------------------- */

// GET /admin/clientes?q=&desde=&hasta=&orden=desc
async function listarClientes(req, res) {
  const { q, desde, hasta, orden } = req.query;

  const clientes = await prisma.cliente.findMany({
    where: q ? { nombre: { contains: q, mode: "insensitive" } } : undefined,
    include: { pedidos: true },
  });

  let resultado = clientes.map((cl) => {
    const totalGastado = cl.pedidos.reduce((s, p) => s + Number(p.total), 0);
    const ultimoPedido = cl.pedidos.reduce(
      (max, p) => (!max || p.createdAt > max ? p.createdAt : max),
      null
    );
    return {
      id: cl.id,
      nombre: cl.nombre,
      telefono: cl.telefono,
      barrio: cl.barrio,
      tipo: cl.tipo,
      pago: cl.pago,
      cantidadPedidos: cl.pedidos.length,
      totalGastado,
      ultimoPedido,
    };
  });

  if (desde) resultado = resultado.filter((c) => c.ultimoPedido && c.ultimoPedido >= new Date(desde));
  if (hasta) resultado = resultado.filter((c) => c.ultimoPedido && c.ultimoPedido <= new Date(hasta));

  resultado.sort((a, b) => (orden === "asc" ? a.totalGastado - b.totalGastado : b.totalGastado - a.totalGastado));

  res.json(resultado);
}

/* ---------------------------- CATÁLOGO ---------------------------- */

async function listarProductosAdmin(req, res) {
  const productos = await prisma.producto.findMany({ orderBy: { id: "asc" } });
  res.json(productos);
}

async function crearProducto(req, res) {
  const { nombre, descripcion, precio } = req.body;
  if (!nombre || precio == null) return res.status(400).json({ error: "Faltan datos del producto" });

  const producto = await prisma.producto.create({ data: { nombre, descripcion: descripcion || "", precio } });
  emitProductoActualizado(producto);
  res.status(201).json(producto);
}

async function actualizarProducto(req, res) {
  const id = Number(req.params.id);
  const { nombre, descripcion, precio, activo } = req.body;

  const producto = await prisma.producto.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(precio !== undefined && { precio }),
      ...(activo !== undefined && { activo }),
    },
  });

  emitProductoActualizado(producto);
  res.json(producto);
}

/* ---------------------------- CAMIONES Y ZONAS ---------------------------- */

async function listarCamiones(req, res) {
  const camiones = await prisma.camion.findMany({
    include: { zonas: { orderBy: { orden: "asc" } }, chofer: true },
    orderBy: { id: "asc" },
  });
  res.json(
    camiones.map((cm) => ({
      id: cm.id,
      nombre: cm.nombre,
      color: cm.color,
      activo: cm.activo,
      chofer: cm.chofer ? { nombre: cm.chofer.nombre, usuario: cm.chofer.usuario } : null,
      barrios: cm.zonas.map((z) => z.barrio),
    }))
  );
}

// PATCH /admin/camiones/:id   body: { nombre?, color?, choferNombre? }
async function actualizarCamion(req, res) {
  const id = Number(req.params.id);
  const { nombre, color, choferNombre } = req.body;

  const camion = await prisma.camion.update({
    where: { id },
    data: { ...(nombre !== undefined && { nombre }), ...(color !== undefined && { color }) },
  });

  if (choferNombre !== undefined) {
    await prisma.chofer.updateMany({ where: { camionId: id }, data: { nombre: choferNombre } });
  }

  emitCamionActualizado(camion);
  res.json(camion);
}

// POST /admin/camiones   body: { nombre, color, choferNombre, usuario, password }
async function crearCamion(req, res) {
  const { hashPassword } = require("../utils/password");
  const { nombre, color, choferNombre, usuario, password } = req.body;
  if (!nombre || !choferNombre || !usuario || !password) {
    return res.status(400).json({ error: "Faltan datos del camión o del chofer" });
  }

  const camion = await prisma.camion.create({ data: { nombre, color: color || "#4FD1C5" } });
  const passwordHash = await hashPassword(password);
  await prisma.chofer.create({ data: { nombre: choferNombre, usuario, passwordHash, camionId: camion.id } });

  emitCamionActualizado(camion);
  res.status(201).json(camion);
}

// GET /admin/zonas — listado completo, incluidas las que todavía no tienen camión
async function listarZonas(req, res) {
  const zonas = await prisma.zona.findMany({ include: { camion: true }, orderBy: { barrio: "asc" } });
  res.json(
    zonas.map((z) => ({
      id: z.id,
      barrio: z.barrio,
      camionId: z.camionId,
      camionNombre: z.camion ? z.camion.nombre : null,
    }))
  );
}

// POST /admin/zonas   body: { barrio }  — crea una zona operativa nueva, sin camión asignado todavía
async function crearZona(req, res) {
  const { barrio } = req.body;
  if (!barrio) return res.status(400).json({ error: "Falta el nombre del barrio" });

  const existente = await prisma.zona.findUnique({ where: { barrio } });
  if (existente) return res.status(409).json({ error: "Ese barrio ya existe" });

  const zona = await prisma.zona.create({ data: { barrio, orden: 0, camionId: null } });
  res.status(201).json(zona);
}

// PATCH /admin/zonas/:id   body: { barrio }  — renombra una zona (y arrastra el cambio a los pedidos ya creados con ese barrio)
async function renombrarZona(req, res) {
  const id = Number(req.params.id);
  const { barrio } = req.body;
  if (!barrio) return res.status(400).json({ error: "Falta el nombre nuevo" });

  const actual = await prisma.zona.findUnique({ where: { id } });
  if (!actual) return res.status(404).json({ error: "Zona no encontrada" });

  const duplicada = await prisma.zona.findUnique({ where: { barrio } });
  if (duplicada && duplicada.id !== id) return res.status(409).json({ error: "Ya existe una zona con ese nombre" });

  const [zona] = await prisma.$transaction([
    prisma.zona.update({ where: { id }, data: { barrio } }),
    prisma.pedido.updateMany({ where: { barrio: actual.barrio }, data: { barrio } }),
  ]);

  res.json(zona);
}

// DELETE /admin/zonas/:id — borra la zona por completo (deja de operar ahí)
async function eliminarZona(req, res) {
  await prisma.zona.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
}

// PATCH /admin/zonas/:id/camion   body: { camionId }  — camionId puede venir null para "soltarla" (queda sin asignar, no se borra)
async function asignarZonaACamion(req, res) {
  const id = Number(req.params.id);
  const { camionId } = req.body;

  let orden = 0;
  if (camionId) orden = await prisma.zona.count({ where: { camionId } });

  const zona = await prisma.zona.update({ where: { id }, data: { camionId: camionId || null, orden } });
  if (camionId) emitCamionActualizado(await prisma.camion.findUnique({ where: { id: camionId } }));
  res.json(zona);
}

/* ---------------------------- CALENDARIO (días no hábiles) ---------------------------- */

async function listarDiasNoHabiles(req, res) {
  const dias = await prisma.diaNoHabil.findMany({ orderBy: { fecha: "asc" } });
  res.json(dias);
}

async function agregarDiaNoHabil(req, res) {
  const { fecha, motivo } = req.body;
  if (!fecha) return res.status(400).json({ error: "Falta la fecha" });
  const dia = await prisma.diaNoHabil.create({ data: { fecha: new Date(fecha), motivo: motivo || "" } });
  res.status(201).json(dia);
}

async function quitarDiaNoHabil(req, res) {
  await prisma.diaNoHabil.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
}

/* ---------------------------- DASHBOARD ---------------------------- */

async function dashboard(req, res) {
  const { hoy } = require("../utils/fechas");
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [clientesTotales, pedidosHoy, pedidosDelMes, camiones] = await Promise.all([
    prisma.cliente.count(),
    prisma.pedido.findMany({ where: { fechaEntrega: hoy() } }),
    prisma.pedido.findMany({ where: { createdAt: { gte: inicioMes } } }),
    prisma.camion.findMany(),
  ]);

  const ingresosMes = pedidosDelMes.reduce((s, p) => s + Number(p.total), 0);
  const finalizadosHoy = pedidosHoy.filter((p) => p.estado !== "pendiente");
  const tasaEntrega = finalizadosHoy.length
    ? Math.round((finalizadosHoy.filter((p) => p.estado === "entregado").length / finalizadosHoy.length) * 100)
    : 0;

  const porCamion = camiones.map((cm) => ({
    camion: cm.nombre,
    color: cm.color,
    pedidos: pedidosHoy.filter((p) => p.camionId === cm.id).length,
  }));

  res.json({ clientesTotales, pedidosHoy: pedidosHoy.length, ingresosMes, tasaEntrega, porCamion });
}

module.exports = {
  listarPedidos,
  reasignarCamion,
  listarClientes,
  listarProductosAdmin,
  crearProducto,
  actualizarProducto,
  listarCamiones,
  crearCamion,
  actualizarCamion,
  listarZonas,
  crearZona,
  renombrarZona,
  eliminarZona,
  asignarZonaACamion,
  listarDiasNoHabiles,
  agregarDiaNoHabil,
  quitarDiaNoHabil,
  dashboard,
};
