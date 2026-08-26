const { Prisma } = require("@prisma/client");
const prisma = require("../db");
const { proximoDiaHabil } = require("../utils/diaHabil");
const { emitPedidoCreado } = require("../events");
const { SEGMENTO_POR_DEFECTO, esSegmentoValido } = require("../constants/segmentos");
const { esPagoValido } = require("../constants/pagos");
const { fechaAdmitidaParaHorario, proximasFechas } = require("../utils/agenda");
const { nuevaClave, guardarArchivo, obtenerArchivo, borrarArchivo } = require("../services/archivos");

function urlImagenProducto(req, producto) {
  return producto.imagenKey ? `${req.protocol}://${req.get("host")}/public/productos/${producto.id}/imagen?v=${encodeURIComponent(producto.updatedAt.toISOString())}` : null;
}

async function enviarImagen(res, archivo, cacheControl) {
  res.set("Content-Type", archivo.ContentType || "application/octet-stream");
  res.set("Cache-Control", cacheControl);
  if (archivo.ContentLength) res.set("Content-Length", String(archivo.ContentLength));
  archivo.Body.on("error", () => { if (!res.headersSent) res.status(502).end(); else res.end(); });
  archivo.Body.pipe(res);
}

// GET /public/productos?categoria=consumo_personal|dispenser_frio_calor|comercio_reventa
async function listarProductos(req, res) {
  const { categoria } = req.query;
  if (categoria && !esSegmentoValido(categoria)) {
    return res.status(400).json({ error: "Categoría inválida" });
  }
  const where = { activo: true };
  if (categoria) where.categoria = categoria;
  const productos = await prisma.producto.findMany({ where, orderBy: { id: "asc" } });
  res.json(productos.map((producto) => ({ ...producto, imagenUrl: urlImagenProducto(req, producto), imagenKey: undefined, imagenMime: undefined })));
}

async function obtenerImagenProducto(req, res) {
  const id = Number(req.params.id);
  const producto = await prisma.producto.findUnique({ where: { id }, select: { imagenKey: true } });
  if (!producto?.imagenKey) return res.status(404).json({ error: "Este producto no tiene imagen" });
  try {
    const archivo = await obtenerArchivo(producto.imagenKey);
    await enviarImagen(res, archivo, "public, max-age=3600, stale-while-revalidate=86400");
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NoSuchKey") return res.status(404).json({ error: "La imagen ya no está disponible" });
    throw error;
  }
}

async function obtenerDatosTransferencia(_req, res) {
  const config = await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  res.json({
    titular: config.transferenciaTitular,
    banco: config.transferenciaBanco,
    alias: config.transferenciaAlias,
    cbu: config.transferenciaCbu,
    cuit: config.transferenciaCuit,
    configurados: Boolean(config.transferenciaAlias || config.transferenciaCbu),
  });
}

// Lista de barrios disponibles para el <select> del formulario de pedido.
// Solo se muestran los que ya tienen un camión asignado — una zona "suelta" no se puede entregar todavía.
async function listarZonas(req, res) {
  const zonas = await prisma.zona.findMany({
    where: { camionId: { not: null } },
    include: {
      camion: true,
      horarios: { where: { activo: true }, orderBy: [{ diaSemana: "asc" }, { horaDesde: "asc" }] },
    },
    orderBy: { barrio: "asc" },
  });
  res.json(zonas.map((z) => ({
    barrio: z.barrio,
    camionId: z.camionId,
    camionNombre: z.camion.nombre,
    diasEntrega: [...new Set(z.horarios.map((h) => h.diaSemana))],
  })));
}

// GET /public/disponibilidad?barrio=Alberdi
// Devuelve fechas futuras y franjas aproximadas con cupo real para el barrio elegido.
async function listarDisponibilidad(req, res) {
  const barrio = String(req.query.barrio || "").trim();
  if (!barrio) return res.status(400).json({ error: "Elegí un barrio para ver sus días de entrega" });

  const zona = await prisma.zona.findUnique({
    where: { barrio },
    include: {
      camion: true,
      horarios: { where: { activo: true }, orderBy: [{ diaSemana: "asc" }, { horaDesde: "asc" }] },
    },
  });
  if (!zona?.camion) return res.status(422).json({ error: "Todavía no hay reparto configurado para ese barrio" });

  const fechas = proximasFechas(new Date(), 28);
  const idsHorario = zona.horarios.map((h) => h.id);
  const [diasNoHabiles, pedidos] = await Promise.all([
    prisma.diaNoHabil.findMany({
      where: { fecha: { gte: fechas[0], lte: fechas[fechas.length - 1] } },
      select: { fecha: true },
    }),
    idsHorario.length
      ? prisma.pedido.findMany({
          where: {
            horarioZonaId: { in: idsHorario },
            fechaEntrega: { gte: fechas[0], lte: fechas[fechas.length - 1] },
            estado: { not: "no_atendido" },
          },
          select: { horarioZonaId: true, fechaEntrega: true },
        })
      : [],
  ]);

  const noHabiles = new Set(diasNoHabiles.map((d) => d.fecha.toISOString().slice(0, 10)));
  const ocupacion = new Map();
  for (const pedido of pedidos) {
    const key = `${pedido.horarioZonaId}:${pedido.fechaEntrega.toISOString().slice(0, 10)}`;
    ocupacion.set(key, (ocupacion.get(key) || 0) + 1);
  }

  const disponibilidad = fechas.flatMap((fecha) => {
    const fechaISO = fecha.toISOString().slice(0, 10);
    if (noHabiles.has(fechaISO)) return [];
    const horarios = zona.horarios
      .filter((h) => h.diaSemana === fecha.getUTCDay())
      .map((h) => ({
        id: h.id,
        horaDesde: h.horaDesde,
        horaHasta: h.horaHasta,
        cupoDisponible: Math.max(0, h.cupoMaximo - (ocupacion.get(`${h.id}:${fechaISO}`) || 0)),
      }))
      .filter((h) => h.cupoDisponible > 0);
    return horarios.length ? [{ fecha: fechaISO, horarios }] : [];
  });

  res.json({ barrio: zona.barrio, camionNombre: zona.camion.nombre, disponibilidad });
}

// GET /public/proxima-entrega
// La vidriera usa la misma regla real que la creacion del pedido, incluidos fines
// de semana y dias no habiles configurados por el administrador.
async function obtenerProximaEntrega(req, res) {
  const fechaEntrega = await proximoDiaHabil();
  res.json({ fechaEntrega });
}

async function crearPedido(req, res) {
  let datos = req.body;
  if (typeof req.body.pedido === "string") {
    try { datos = JSON.parse(req.body.pedido); }
    catch { return res.status(400).json({ error: "No pudimos leer los datos del pedido" }); }
  }
  const { nombre, telefono, barrio, calle, tipo, segmento, pago, items, notas, fechaEntrega, horarioZonaId } = datos;
  const segmentoElegido = segmento || SEGMENTO_POR_DEFECTO;
  const horarioId = Number(horarioZonaId);

  if (!nombre || !telefono || !barrio || !calle || !items || items.length === 0 || !fechaEntrega || !horarioZonaId) {
    return res.status(400).json({ error: "Faltan datos del pedido" });
  }
  if (!esSegmentoValido(segmentoElegido)) {
    return res.status(400).json({ error: "Categoría inválida" });
  }
  if (!Number.isInteger(horarioId) || horarioId <= 0) {
    return res.status(400).json({ error: "Elegí una franja de entrega válida" });
  }
  if (!esPagoValido(pago)) {
    return res.status(400).json({ error: "Elegí Efectivo o Transferencia como forma de pago" });
  }
  if (pago === "Transferencia" && !req.file) {
    return res.status(400).json({ error: "Adjuntá la captura del pago por transferencia" });
  }
  if (pago !== "Transferencia" && req.file) {
    return res.status(400).json({ error: "El comprobante solo corresponde a pagos por transferencia" });
  }
  if (typeof notas !== "undefined" && typeof notas !== "string") {
    return res.status(400).json({ error: "Las notas no tienen un formato válido" });
  }
  const notasNormalizadas = (notas || "").trim();
  if (notasNormalizadas.length > 500) {
    return res.status(400).json({ error: "Las notas pueden tener hasta 500 caracteres" });
  }
  if (!items.every((i) => Number.isInteger(i.productoId) && Number.isInteger(i.cantidad) && i.cantidad > 0)) {
    return res.status(400).json({ error: "Revisá las cantidades del pedido" });
  }

  const idsProducto = [...new Set(items.map((i) => i.productoId))];
  if (idsProducto.length !== items.length) return res.status(400).json({ error: "Hay productos repetidos en el pedido" });
  const productos = await prisma.producto.findMany({
    where: { id: { in: idsProducto }, activo: true, categoria: segmentoElegido },
  });
  if (productos.length !== items.length) {
    return res.status(400).json({ error: "Algún producto del pedido ya no existe o está desactivado" });
  }
  if (pago === "Transferencia") {
    const config = await prisma.configuracion.findUnique({ where: { id: 1 } });
    if (!config || (!config.transferenciaAlias && !config.transferenciaCbu)) {
      return res.status(409).json({ error: "La transferencia todavía no está habilitada. Elegí Efectivo o escribinos para coordinar" });
    }
  }

  const total = items.reduce((suma, i) => {
    const p = productos.find((p) => p.id === i.productoId);
    return suma + Number(p.precio) * i.cantidad;
  }, 0);

  let pedido;
  let comprobanteKey = null;
  try {
    if (req.file) {
      comprobanteKey = nuevaClave("comprobantes", req.file.mimetype);
      await guardarArchivo({ key: comprobanteKey, buffer: req.file.buffer, mime: req.file.mimetype });
    }
    pedido = await prisma.$transaction(async (tx) => {
      // El bloqueo evita que dos pedidos simultáneos tomen el último cupo de una franja.
      const bloqueado = await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "horarios_zona" WHERE id = ${horarioId} FOR UPDATE`
      );
      if (bloqueado.length === 0) throw Object.assign(new Error(), { funcional: true, status: 404, mensaje: "La franja elegida ya no existe" });

      const horario = await tx.horarioZona.findUnique({
        where: { id: horarioId },
        include: { zona: { include: { camion: true } } },
      });
      if (!horario?.activo || horario.zona.barrio !== barrio) {
        throw Object.assign(new Error(), { funcional: true, status: 409, mensaje: "La franja elegida cambió. Elegí otra opción" });
      }
      if (!horario.zona.camion) {
        throw Object.assign(new Error(), { funcional: true, status: 422, mensaje: "Todavía no cubrimos esa zona" });
      }

      const fechaProgramada = fechaAdmitidaParaHorario(fechaEntrega, horario.diaSemana);
      if (!fechaProgramada) {
        throw Object.assign(new Error(), { funcional: true, status: 400, mensaje: "La fecha no corresponde a los días de entrega del barrio" });
      }
      const noHabil = await tx.diaNoHabil.findUnique({ where: { fecha: fechaProgramada } });
      if (noHabil) {
        throw Object.assign(new Error(), { funcional: true, status: 409, mensaje: "Ese día ya no está disponible. Elegí otra fecha" });
      }

      const ocupados = await tx.pedido.count({
        where: { horarioZonaId: horario.id, fechaEntrega: fechaProgramada, estado: { not: "no_atendido" } },
      });
      if (ocupados >= horario.cupoMaximo) {
        throw Object.assign(new Error(), { funcional: true, status: 409, mensaje: "Esa franja acaba de completar su cupo. Elegí otra" });
      }

      const cliente = await tx.cliente.create({
        data: { nombre: nombre.trim(), telefono: telefono.trim(), barrio, calle: calle.trim(), tipo: tipo || "casa", pago },
      });

      return tx.pedido.create({
        data: {
          clienteId: cliente.id,
          camionId: horario.zona.camion.id,
          direccion: calle.trim(),
          barrio,
          tipo: tipo || "casa",
          segmento: segmentoElegido,
          pago,
          fechaEntrega: fechaProgramada,
          horarioZonaId: horario.id,
          horaDesde: horario.horaDesde,
          horaHasta: horario.horaHasta,
          notas: notasNormalizadas,
          comprobanteKey,
          comprobanteMime: req.file?.mimetype || null,
          comprobanteFecha: req.file ? new Date() : null,
          total,
          items: {
            create: items.map((i) => {
              const p = productos.find((producto) => producto.id === i.productoId);
              return {
                productoId: i.productoId,
                productoNombre: p.nombre,
                cantidad: i.cantidad,
                precioUnitario: p.precio,
              };
            }),
          },
        },
        include: { items: true, camion: true },
      });
    });
  } catch (error) {
    if (comprobanteKey) await borrarArchivo(comprobanteKey).catch(() => {});
    if (error.funcional) return res.status(error.status).json({ error: error.mensaje });
    throw error;
  }

  emitPedidoCreado(pedido);

  res.status(201).json({
    pedidoId: pedido.id,
    camion: pedido.camion.nombre,
    fechaEntrega: pedido.fechaEntrega,
    horaDesde: pedido.horaDesde,
    horaHasta: pedido.horaHasta,
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

module.exports = { listarProductos, obtenerImagenProducto, obtenerDatosTransferencia, listarZonas, listarDisponibilidad, obtenerProximaEntrega, crearPedido, verificarAreaPrivada };
