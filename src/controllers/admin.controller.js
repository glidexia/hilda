const prisma = require("../db");
const { resolverFecha, hoy } = require("../utils/fechas");
const { ordenarPorRuta } = require("../utils/ruta");
const { emitPedidoActualizado, emitCamionActualizado, emitProductoActualizado } = require("../events");
const { SEGMENTO_POR_DEFECTO, esSegmentoValido } = require("../constants/segmentos");
const { hashPassword, compararPassword } = require("../utils/password");
const { esHorarioValido } = require("../utils/agenda");
const { nuevaClave, guardarArchivo, obtenerArchivo, borrarArchivo } = require("../services/archivos");

function urlImagenProducto(req, producto) {
  return producto.imagenKey ? `${req.protocol}://${req.get("host")}/public/productos/${producto.id}/imagen?v=${encodeURIComponent(producto.updatedAt.toISOString())}` : null;
}

/* ---------------------------- PEDIDOS ---------------------------- */

// GET /admin/pedidos?dia=hoy&desde=&hasta=&camionId=&estado=&q=
// "dia" (ayer/hoy/manana) y "desde/hasta" (rango de fechas) son excluyentes: si viene desde/hasta, manda eso.
async function listarPedidos(req, res) {
  const { dia, desde, hasta, camionId, estado, q } = req.query;

  const where = {};
  if (desde || hasta) {
    where.fechaEntrega = {};
    if (desde) where.fechaEntrega.gte = new Date(desde);
    if (hasta) where.fechaEntrega.lte = new Date(hasta);
  } else if (dia) {
    const fecha = resolverFecha(dia);
    if (!fecha) return res.status(400).json({ error: "Dia invalido. Usa ayer, hoy, manana o una fecha AAAA-MM-DD" });
    where.fechaEntrega = fecha;
  }
  if (camionId) where.camionId = Number(camionId);
  if (estado) where.estado = estado;
  if (q) where.cliente = { nombre: { contains: q, mode: "insensitive" } };

  const [pedidos, camiones, zonas] = await Promise.all([
    prisma.pedido.findMany({ where, include: { cliente: true, camion: true }, orderBy: { fechaEntrega: "desc" } }),
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
          pago: p.pago,
          pagoConfirmado: p.pagoConfirmado,
          tieneComprobante: Boolean(p.comprobanteKey),
          horaDesde: p.horaDesde,
          horaHasta: p.horaHasta,
          notas: p.notas,
          direccion: p.direccion,
          telefono: p.cliente.telefono,
          total: p.total,
        })),
      };
    })
    .filter((g) => g.pedidos.length > 0);

  res.json(grupos);
}

async function obtenerComprobantePedido(req, res) {
  const id = Number(req.params.id);
  const pedido = await prisma.pedido.findUnique({ where: { id }, select: { comprobanteKey: true, comprobanteMime: true } });
  if (!pedido?.comprobanteKey) return res.status(404).json({ error: "Este pedido no tiene comprobante" });
  try {
    const archivo = await obtenerArchivo(pedido.comprobanteKey);
    res.set("Content-Type", archivo.ContentType || pedido.comprobanteMime || "application/octet-stream");
    res.set("Cache-Control", "private, no-store");
    res.set("Content-Disposition", `inline; filename="comprobante-pedido-${id}"`);
    archivo.Body.on("error", () => { if (!res.headersSent) res.status(502).end(); else res.end(); });
    archivo.Body.pipe(res);
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NoSuchKey") return res.status(404).json({ error: "El comprobante ya no está disponible" });
    throw error;
  }
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
      (max, p) => (!max || p.createdAt > max.createdAt ? p : max),
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
      ultimoPedido: ultimoPedido?.createdAt || null,
      ultimoPedidoId: ultimoPedido?.id || null,
      tieneComprobante: Boolean(ultimoPedido?.comprobanteKey),
    };
  });

  if (desde) resultado = resultado.filter((c) => c.ultimoPedido && c.ultimoPedido >= new Date(desde));
  if (hasta) resultado = resultado.filter((c) => c.ultimoPedido && c.ultimoPedido <= new Date(hasta));

  resultado.sort((a, b) => (orden === "asc" ? a.totalGastado - b.totalGastado : b.totalGastado - a.totalGastado));

  res.json(resultado);
}

/* ---------------------------- CATÁLOGO ---------------------------- */

// GET /admin/productos?categoria=consumo_personal|dispenser_frio_calor|comercio_reventa
async function listarProductosAdmin(req, res) {
  const { categoria } = req.query;
  if (categoria && !esSegmentoValido(categoria)) {
    return res.status(400).json({ error: "Categoría inválida" });
  }
  const productos = await prisma.producto.findMany({
    where: categoria ? { categoria } : undefined,
    orderBy: { id: "asc" },
  });
  res.json(productos.map((producto) => ({
    ...producto,
    imagenUrl: urlImagenProducto(req, producto),
    imagenKey: undefined,
    imagenMime: undefined,
  })));
}

async function crearProducto(req, res) {
  const { nombre, descripcion, precio, categoria } = req.body;
  if (!nombre || precio == null) return res.status(400).json({ error: "Faltan datos del producto" });
  if (categoria && !esSegmentoValido(categoria)) {
    return res.status(400).json({ error: "Categoría inválida" });
  }

  const producto = await prisma.producto.create({
    data: { nombre, descripcion: descripcion || "", precio, categoria: categoria || SEGMENTO_POR_DEFECTO },
  });
  emitProductoActualizado(producto);
  res.status(201).json(producto);
}

async function actualizarProducto(req, res) {
  const id = Number(req.params.id);
  const { nombre, descripcion, precio, activo, categoria } = req.body;
  if (categoria && !esSegmentoValido(categoria)) {
    return res.status(400).json({ error: "Categoría inválida" });
  }

  const producto = await prisma.producto.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(precio !== undefined && { precio }),
      ...(activo !== undefined && { activo }),
      ...(categoria !== undefined && { categoria }),
    },
  });

  emitProductoActualizado(producto);
  res.json(producto);
}

async function actualizarImagenProducto(req, res) {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ error: "Elegí una imagen para el producto" });
  const existente = await prisma.producto.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: "El producto ya no existe" });

  const nueva = nuevaClave(`productos/${id}`, req.file.mimetype);
  await guardarArchivo({
    key: nueva,
    buffer: req.file.buffer,
    mime: req.file.mimetype,
    cacheControl: "public, max-age=3600, stale-while-revalidate=86400",
  });

  let producto;
  try {
    producto = await prisma.producto.update({ where: { id }, data: { imagenKey: nueva, imagenMime: req.file.mimetype } });
  } catch (error) {
    await borrarArchivo(nueva).catch(() => {});
    throw error;
  }
  if (existente.imagenKey) await borrarArchivo(existente.imagenKey).catch((error) => console.error("No se pudo borrar la imagen anterior", error));
  emitProductoActualizado(producto);
  res.json({ ...producto, imagenUrl: urlImagenProducto(req, producto), imagenKey: undefined, imagenMime: undefined });
}

async function eliminarImagenProducto(req, res) {
  const id = Number(req.params.id);
  const existente = await prisma.producto.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: "El producto ya no existe" });
  await prisma.producto.update({ where: { id }, data: { imagenKey: null, imagenMime: null } });
  if (existente.imagenKey) await borrarArchivo(existente.imagenKey).catch((error) => console.error("No se pudo borrar la imagen", error));
  emitProductoActualizado({ id, imagenEliminada: true });
  res.json({ id, imagenEliminada: true });
}

async function eliminarProducto(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Producto inválido" });

  const existente = await prisma.producto.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: "El producto ya no existe" });

  // Cada ítem conserva el nombre y precio vendidos. La relación usa SET NULL,
  // por lo que eliminar el producto no altera los pedidos anteriores.
  await prisma.producto.delete({ where: { id } });
  if (existente.imagenKey) await borrarArchivo(existente.imagenKey).catch((error) => console.error("No se pudo borrar la imagen del producto eliminado", error));
  emitProductoActualizado({ id, eliminado: true });
  res.json({ id, eliminado: true });
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
      chofer: cm.chofer ? { id: cm.chofer.id, nombre: cm.chofer.nombre, usuario: cm.chofer.usuario, activo: cm.chofer.activo } : null,
      barrios: cm.zonas.map((z) => z.barrio),
    }))
  );
}

// PATCH /admin/camiones/:id
// body: { nombre?, color?, activo?, choferNombre?, choferUsuario?, choferPassword? }
async function actualizarCamion(req, res) {
  const id = Number(req.params.id);
  const { nombre, color, activo, choferNombre, choferUsuario, choferPassword } = req.body;

  const camion = await prisma.camion.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(color !== undefined && { color }),
      ...(activo !== undefined && { activo }),
    },
  });

  if (choferNombre !== undefined || choferUsuario !== undefined || choferPassword) {
    if (choferUsuario !== undefined) {
      const enUso = await prisma.chofer.findFirst({ where: { usuario: choferUsuario, camionId: { not: id } } });
      if (enUso) return res.status(409).json({ error: "Ese usuario ya lo usa otro chofer" });
    }
    const dataChofer = {
      ...(choferNombre !== undefined && { nombre: choferNombre }),
      ...(choferUsuario !== undefined && { usuario: choferUsuario }),
    };
    if (choferPassword) dataChofer.passwordHash = await hashPassword(choferPassword);
    if (Object.keys(dataChofer).length > 0) {
      await prisma.chofer.updateMany({ where: { camionId: id }, data: dataChofer });
    }
  }

  emitCamionActualizado(camion);
  res.json(camion);
}

// POST /admin/camiones   body: { nombre, color, choferNombre, usuario, password }
async function crearCamion(req, res) {
  const { nombre, color, choferNombre, usuario, password } = req.body;
  if (!nombre || !choferNombre || !usuario || !password) {
    return res.status(400).json({ error: "Faltan datos del camión o del chofer" });
  }
  const usuarioExistente = await prisma.chofer.findUnique({ where: { usuario } });
  if (usuarioExistente) return res.status(409).json({ error: "Ese usuario ya existe" });

  const camion = await prisma.camion.create({ data: { nombre, color: color || "#4FD1C5" } });
  const passwordHash = await hashPassword(password);
  await prisma.chofer.create({ data: { nombre: choferNombre, usuario, passwordHash, camionId: camion.id } });

  emitCamionActualizado(camion);
  res.status(201).json(camion);
}

// DELETE /admin/camiones/:id — solo si no tiene pedidos asociados
async function eliminarCamion(req, res) {
  const id = Number(req.params.id);
  const tienePedidos = await prisma.pedido.findFirst({ where: { camionId: id } });
  if (tienePedidos) return res.status(409).json({ error: "Este camión tiene pedidos en su historial, no se puede eliminar. Podés desactivarlo." });
  await prisma.zona.updateMany({ where: { camionId: id }, data: { camionId: null } });
  await prisma.chofer.deleteMany({ where: { camionId: id } });
  await prisma.camion.delete({ where: { id } });
  res.status(204).end();
}

// GET /admin/zonas — listado completo, incluidas las que todavía no tienen camión
async function listarZonas(req, res) {
  const zonas = await prisma.zona.findMany({
    include: { camion: true, horarios: { orderBy: [{ diaSemana: "asc" }, { horaDesde: "asc" }] } },
    orderBy: { barrio: "asc" },
  });
  res.json(
    zonas.map((z) => ({
      id: z.id,
      barrio: z.barrio,
      camionId: z.camionId,
      camionNombre: z.camion ? z.camion.nombre : null,
      horarios: z.horarios,
    }))
  );
}

// POST /admin/zonas/:id/horarios
async function agregarHorarioZona(req, res) {
  const zonaId = Number(req.params.id);
  const diaSemana = Number(req.body.diaSemana);
  const horaDesde = String(req.body.horaDesde || "");
  const horaHasta = String(req.body.horaHasta || "");
  const cupoMaximo = Number(req.body.cupoMaximo);

  if (!esHorarioValido({ diaSemana, horaDesde, horaHasta, cupoMaximo })) {
    return res.status(400).json({ error: "Revisá el día, el horario y el cupo de la franja" });
  }
  const zona = await prisma.zona.findUnique({ where: { id: zonaId } });
  if (!zona) return res.status(404).json({ error: "Zona no encontrada" });

  const superpuesto = await prisma.horarioZona.findFirst({
    where: {
      zonaId,
      diaSemana,
      activo: true,
      horaDesde: { lt: horaHasta },
      horaHasta: { gt: horaDesde },
    },
  });
  if (superpuesto) return res.status(409).json({ error: "La nueva franja se superpone con otra del mismo día" });

  try {
    const horario = await prisma.horarioZona.create({
      data: { zonaId, diaSemana, horaDesde, horaHasta, cupoMaximo },
    });
    res.status(201).json(horario);
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Esa franja ya está cargada para el barrio" });
    throw error;
  }
}

// DELETE /admin/horarios/:id
async function eliminarHorarioZona(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Franja inválida" });
  const horario = await prisma.horarioZona.findUnique({ where: { id } });
  if (!horario) return res.status(404).json({ error: "La franja ya no existe" });
  await prisma.horarioZona.delete({ where: { id } });
  res.status(204).end();
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
  const fechaNormalizada = new Date(`${fecha}T00:00:00.000Z`);
  if (Number.isNaN(fechaNormalizada.getTime())) return res.status(400).json({ error: "Fecha inválida" });

  const existente = await prisma.diaNoHabil.findUnique({ where: { fecha: fechaNormalizada } });
  if (existente) return res.status(409).json({ error: "Ese día ya está marcado como no hábil" });

  const dia = await prisma.diaNoHabil.create({ data: { fecha: fechaNormalizada, motivo: motivo?.trim() || "" } });
  res.status(201).json(dia);
}

async function quitarDiaNoHabil(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Día no hábil inválido" });

  const existente = await prisma.diaNoHabil.findUnique({ where: { id } });
  if (!existente) return res.status(404).json({ error: "Ese día ya no está marcado como no hábil" });

  await prisma.diaNoHabil.delete({ where: { id } });
  res.status(204).end();
}

/* ---------------------------- PERFIL DEL ADMIN (autogestión) ---------------------------- */

// GET /admin/perfil
async function obtenerPerfil(req, res) {
  const admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
  if (!admin) return res.status(404).json({ error: "No encontrado" });
  res.json({ id: admin.id, nombre: admin.nombre, usuario: admin.usuario });
}

// PATCH /admin/perfil   body: { nombre?, usuario?, passwordActual?, passwordNueva? }
// Para cambiar la contraseña hay que confirmar la actual, por seguridad.
async function actualizarPerfil(req, res) {
  const { nombre, usuario, passwordActual, passwordNueva } = req.body;
  const admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
  if (!admin) return res.status(404).json({ error: "No encontrado" });

  const data = {};
  if (nombre !== undefined) data.nombre = nombre;
  if (usuario !== undefined && usuario !== admin.usuario) {
    const enUso = await prisma.admin.findUnique({ where: { usuario } });
    if (enUso) return res.status(409).json({ error: "Ese usuario ya está en uso" });
    data.usuario = usuario;
  }
  if (passwordNueva) {
    if (!passwordActual) return res.status(400).json({ error: "Confirmá tu contraseña actual para cambiarla" });
    const ok = await compararPassword(passwordActual, admin.passwordHash);
    if (!ok) return res.status(401).json({ error: "La contraseña actual no coincide" });
    data.passwordHash = await hashPassword(passwordNueva);
  }

  const actualizado = await prisma.admin.update({ where: { id: req.user.id }, data });
  res.json({ id: actualizado.id, nombre: actualizado.nombre, usuario: actualizado.usuario });
}

/* ---------------------------- CONFIGURACIÓN (clave del Área Privada) ---------------------------- */

// GET /admin/configuracion
async function obtenerConfiguracion(req, res) {
  const config = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  res.json({
    areaPrivadaConfigurada: Boolean(config.claveAreaPrivada),
    transferencia: {
      titular: config.transferenciaTitular,
      banco: config.transferenciaBanco,
      alias: config.transferenciaAlias,
      cbu: config.transferenciaCbu,
      cuit: config.transferenciaCuit,
    },
  });
}

// PATCH /admin/configuracion   body: { claveAreaPrivada }  — string vacío = "cualquiera puede pasar" (como al principio)
async function actualizarConfiguracion(req, res) {
  const { claveAreaPrivada, transferencia } = req.body;
  const limpiar = (valor, maximo) => String(valor ?? "").trim().slice(0, maximo);
  const data = {};
  if (claveAreaPrivada !== undefined) data.claveAreaPrivada = String(claveAreaPrivada);
  if (transferencia !== undefined) {
    if (!transferencia || typeof transferencia !== "object" || Array.isArray(transferencia)) {
      return res.status(400).json({ error: "Revisá los datos de transferencia" });
    }
    data.transferenciaTitular = limpiar(transferencia.titular, 120);
    data.transferenciaBanco = limpiar(transferencia.banco, 100);
    data.transferenciaAlias = limpiar(transferencia.alias, 80);
    data.transferenciaCbu = limpiar(transferencia.cbu, 30);
    data.transferenciaCuit = limpiar(transferencia.cuit, 20);
  }
  const config = await prisma.configuracion.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  res.json({
    areaPrivadaConfigurada: Boolean(config.claveAreaPrivada),
    transferencia: {
      titular: config.transferenciaTitular,
      banco: config.transferenciaBanco,
      alias: config.transferenciaAlias,
      cbu: config.transferenciaCbu,
      cuit: config.transferenciaCuit,
    },
  });
}

/* ---------------------------- DASHBOARD ---------------------------- */

// GET /admin/dashboard?desde=&hasta=  — sin parámetros, toma los últimos 30 días
async function dashboard(req, res) {
  let { desde, hasta } = req.query;
  const hastaFecha = hasta ? new Date(hasta) : hoy();
  hastaFecha.setUTCHours(23, 59, 59, 999);
  const desdeFecha = desde ? new Date(desde) : new Date(hastaFecha);
  if (!desde) desdeFecha.setUTCDate(desdeFecha.getUTCDate() - 29);
  desdeFecha.setUTCHours(0, 0, 0, 0);

  const [clientesTotales, clientesNuevosPeriodo, pedidosHoy, pedidosPeriodo, camiones] = await Promise.all([
    prisma.cliente.count(),
    prisma.cliente.count({ where: { createdAt: { gte: desdeFecha, lte: hastaFecha } } }),
    prisma.pedido.findMany({ where: { fechaEntrega: hoy() } }),
    prisma.pedido.findMany({ where: { fechaEntrega: { gte: desdeFecha, lte: hastaFecha } } }),
    prisma.camion.findMany(),
  ]);

  const ingresosPeriodo = pedidosPeriodo.reduce((s, p) => s + Number(p.total), 0);
  const finalizados = pedidosPeriodo.filter((p) => p.estado !== "pendiente");
  const tasaEntrega = finalizados.length
    ? Math.round((finalizados.filter((p) => p.estado === "entregado").length / finalizados.length) * 100)
    : 0;

  const porCamion = camiones.map((cm) => ({
    camion: cm.nombre,
    color: cm.color,
    pedidos: pedidosPeriodo.filter((p) => p.camionId === cm.id).length,
  }));

  // Serie diaria (para el gráfico de evolución)
  const porDia = {};
  for (const p of pedidosPeriodo) {
    const key = p.fechaEntrega.toISOString().slice(0, 10);
    if (!porDia[key]) porDia[key] = { fecha: key, pedidos: 0, ingresos: 0 };
    porDia[key].pedidos += 1;
    porDia[key].ingresos += Number(p.total);
  }
  const serieDiaria = Object.values(porDia).sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Top 5 productos más vendidos en el período (por cantidad)
  const items = await prisma.pedidoItem.findMany({
    where: { pedido: { fechaEntrega: { gte: desdeFecha, lte: hastaFecha } } },
    include: { producto: true },
  });
  const acumProductos = {};
  for (const it of items) {
    const nombre = it.producto?.nombre || it.productoNombre;
    const key = it.productoId || `eliminado:${nombre}`;
    if (!acumProductos[key]) acumProductos[key] = { nombre, cantidad: 0, total: 0 };
    acumProductos[key].cantidad += it.cantidad;
    acumProductos[key].total += Number(it.precioUnitario) * it.cantidad;
  }
  const topProductos = Object.values(acumProductos).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);

  res.json({
    rango: { desde: desdeFecha, hasta: hastaFecha },
    clientesTotales,
    clientesNuevosPeriodo,
    pedidosHoy: pedidosHoy.length,
    pedidosPeriodo: pedidosPeriodo.length,
    ingresosPeriodo,
    tasaEntrega,
    porCamion,
    topProductos,
    serieDiaria,
  });
}

module.exports = {
  listarPedidos,
  obtenerComprobantePedido,
  reasignarCamion,
  listarClientes,
  listarProductosAdmin,
  crearProducto,
  actualizarProducto,
  actualizarImagenProducto,
  eliminarImagenProducto,
  eliminarProducto,
  listarCamiones,
  crearCamion,
  actualizarCamion,
  eliminarCamion,
  listarZonas,
  crearZona,
  renombrarZona,
  eliminarZona,
  asignarZonaACamion,
  agregarHorarioZona,
  eliminarHorarioZona,
  listarDiasNoHabiles,
  agregarDiaNoHabil,
  quitarDiaNoHabil,
  obtenerPerfil,
  actualizarPerfil,
  obtenerConfiguracion,
  actualizarConfiguracion,
  dashboard,
};
