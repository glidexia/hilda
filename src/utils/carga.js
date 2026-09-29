function acumularProductos(pedidos = []) {
  const productos = new Map();
  for (const pedido of pedidos) {
    for (const item of pedido.items || []) {
      const nombre = item.producto?.nombre || item.productoNombre || "Producto";
      const actual = productos.get(nombre) || { nombre, cantidad: 0 };
      actual.cantidad += Number(item.cantidad) || 0;
      productos.set(nombre, actual);
    }
  }
  return [...productos.values()].sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
}

function resumirCarga(pedidos = []) {
  const pendientes = pedidos.filter((pedido) => pedido.estado === "pendiente");
  return {
    pedidosProgramados: pedidos.length,
    pedidosPendientes: pendientes.length,
    programado: acumularProductos(pedidos),
    pendiente: acumularProductos(pendientes),
  };
}

module.exports = { acumularProductos, resumirCarga };
