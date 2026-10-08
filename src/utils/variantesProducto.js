function resolverItemProducto(producto, item) {
  const variantes = Array.isArray(producto.variantes) ? producto.variantes : [];
  const variante = item.varianteId == null ? null : variantes.find((actual) => actual.id === item.varianteId);

  if (producto.categoria === "comercio_reventa" && variantes.length > 0) {
    if (!variante) return { error: `Elegí una opción mayorista válida para ${producto.nombre}` };
    if (item.cantidad !== variante.cantidad) return { error: `La cantidad de ${producto.nombre} ya no coincide con la opción elegida` };
  } else if (item.varianteId != null && !variante) {
    return { error: `La opción elegida para ${producto.nombre} ya no está disponible` };
  }

  return {
    producto,
    variante,
    cantidad: item.cantidad,
    precioUnitario: variante ? variante.precioUnitario : producto.precio,
    nombre: variante ? `${producto.nombre} · ${variante.nombre}` : producto.nombre,
  };
}

module.exports = { resolverItemProducto };
