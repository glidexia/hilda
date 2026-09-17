function dinero(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function calcularCaja(pedidos = [], extracciones = []) {
  const entregados = pedidos.filter((pedido) => pedido.estado === "entregado");
  const productos = new Map();
  let ventasTotal = 0;
  let efectivoCobrado = 0;
  let transferenciasCobradas = 0;
  let pendienteCobro = 0;

  for (const pedido of entregados) {
    const total = Number(pedido.total) || 0;
    ventasTotal += total;
    if (pedido.pagoConfirmado === "Efectivo") efectivoCobrado += total;
    else if (pedido.pagoConfirmado === "Transferencia") transferenciasCobradas += total;
    else pendienteCobro += total;

    for (const item of pedido.items || []) {
      const nombre = item.producto?.nombre || item.productoNombre || "Producto";
      const actual = productos.get(nombre) || { nombre, cantidad: 0, total: 0 };
      actual.cantidad += Number(item.cantidad) || 0;
      actual.total += (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0);
      productos.set(nombre, actual);
    }
  }

  const extraccionesTotal = extracciones.reduce((suma, extraccion) => suma + (Number(extraccion.monto) || 0), 0);
  return {
    pedidosEntregados: entregados.length,
    ventasTotal: dinero(ventasTotal),
    efectivoCobrado: dinero(efectivoCobrado),
    transferenciasCobradas: dinero(transferenciasCobradas),
    pendienteCobro: dinero(pendienteCobro),
    extraccionesTotal: dinero(extraccionesTotal),
    efectivoEsperado: dinero(efectivoCobrado - extraccionesTotal),
    productos: [...productos.values()]
      .map((producto) => ({ ...producto, total: dinero(producto.total) }))
      .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre)),
  };
}

module.exports = { calcularCaja, dinero };
