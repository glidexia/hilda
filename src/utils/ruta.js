function numeroCalle(direccion) {
  const m = String(direccion).match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

// "ordenPorBarrio" es un mapa { barrio: orden } sacado de la tabla "zonas" para un camión.
// Se pasa aparte (en vez de consultar la base acá) para poder ordenar varias tandas de pedidos
// sin repetir la consulta.
function ordenarPorRuta(pedidos, ordenPorBarrio) {
  return [...pedidos].sort((a, b) => {
    const fechaA = a.fechaEntrega ? new Date(a.fechaEntrega).getTime() : 0;
    const fechaB = b.fechaEntrega ? new Date(b.fechaEntrega).getTime() : 0;
    if (fechaA !== fechaB) return fechaA - fechaB;

    // La hoja del chofer se recorre primero por horario. Dentro del mismo turno
    // se conserva el orden de zonas y de alturas de calle configurado para la ruta.
    const horaA = a.horaDesde || "99:99";
    const horaB = b.horaDesde || "99:99";
    if (horaA !== horaB) return horaA.localeCompare(horaB);

    const pa = ordenPorBarrio[a.barrio] ?? 999;
    const pb = ordenPorBarrio[b.barrio] ?? 999;
    if (pa !== pb) return pa - pb;
    const numeroA = numeroCalle(a.direccion);
    const numeroB = numeroCalle(b.direccion);
    if (numeroA !== numeroB) return numeroA - numeroB;
    return (a.id || 0) - (b.id || 0);
  });
}

module.exports = { ordenarPorRuta, numeroCalle };
