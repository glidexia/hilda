function numeroCalle(direccion) {
  const m = String(direccion).match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

// "ordenPorBarrio" es un mapa { barrio: orden } sacado de la tabla "zonas" para un camión.
// Se pasa aparte (en vez de consultar la base acá) para poder ordenar varias tandas de pedidos
// sin repetir la consulta.
function ordenarPorRuta(pedidos, ordenPorBarrio) {
  return [...pedidos].sort((a, b) => {
    const pa = ordenPorBarrio[a.barrio] ?? 999;
    const pb = ordenPorBarrio[b.barrio] ?? 999;
    if (pa !== pb) return pa - pb;
    return numeroCalle(a.direccion) - numeroCalle(b.direccion);
  });
}

module.exports = { ordenarPorRuta, numeroCalle };
