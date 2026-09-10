function numeroCalle(direccion) {
  // El domicilio suele llegar como "Dean Funes 1653 3B - Alberdi". La
  // implementación anterior buscaba un número al final de toda la cadena,
  // por lo que esos domicilios quedaban todos con altura 0 y se ordenaban
  // por id. Tomamos el tramo previo al barrio y priorizamos la primera altura
  // razonable, ignorando números del nombre de la calle y del departamento.
  const tramoDomicilio = String(direccion || "").split(/\s+-\s+|[,;]/, 1)[0];
  const numeros = [...tramoDomicilio.matchAll(/\b(\d{1,5})\b/g)].map((match) => Number(match[1]));
  return numeros.find((numero) => numero >= 100) ?? numeros.find((numero) => numero >= 10) ?? numeros.at(-1) ?? Number.MAX_SAFE_INTEGER;
}

function coordenadasValidas(valor) {
  if (valor?.latitud === null || valor?.latitud === undefined || valor?.latitud === "" || valor?.longitud === null || valor?.longitud === undefined || valor?.longitud === "") return false;
  const latitud = Number(valor?.latitud);
  const longitud = Number(valor?.longitud);
  return Number.isFinite(latitud) && Number.isFinite(longitud) && Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180;
}

function distanciaKm(a, b) {
  if (!coordenadasValidas(a) || !coordenadasValidas(b)) return Number.POSITIVE_INFINITY;
  const radianes = (grados) => (grados * Math.PI) / 180;
  const lat1 = radianes(Number(a.latitud));
  const lat2 = radianes(Number(b.latitud));
  const dLat = lat2 - lat1;
  const dLon = radianes(Number(b.longitud) - Number(a.longitud));
  const senoLat = Math.sin(dLat / 2);
  const senoLon = Math.sin(dLon / 2);
  const h = senoLat * senoLat + Math.cos(lat1) * Math.cos(lat2) * senoLon * senoLon;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function distanciaRecorrido(pedidos, origen) {
  if (!pedidos.length) return 0;
  let distancia = distanciaKm(origen, pedidos[0]);
  for (let i = 1; i < pedidos.length; i += 1) distancia += distanciaKm(pedidos[i - 1], pedidos[i]);
  return distancia + distanciaKm(pedidos.at(-1), origen);
}

// Heurística liviana para el reparto diario: parte del galpón, enlaza siempre
// la parada más cercana y después mejora el circuito evitando cruces obvios.
// Mantiene la primera parada cercana al origen y considera el regreso al galpón.
function ordenarPorCercania(pedidos, origen) {
  const pendientes = [...pedidos];
  const ruta = [];
  let actual = origen;
  while (pendientes.length) {
    let mejorIndice = 0;
    let mejorDistancia = distanciaKm(actual, pendientes[0]);
    for (let i = 1; i < pendientes.length; i += 1) {
      const distancia = distanciaKm(actual, pendientes[i]);
      if (distancia < mejorDistancia || (distancia === mejorDistancia && (pendientes[i].id || 0) < (pendientes[mejorIndice].id || 0))) {
        mejorIndice = i;
        mejorDistancia = distancia;
      }
    }
    actual = pendientes.splice(mejorIndice, 1)[0];
    ruta.push(actual);
  }

  let mejoro = true;
  while (mejoro && ruta.length > 3) {
    mejoro = false;
    const distanciaActual = distanciaRecorrido(ruta, origen);
    for (let inicio = 1; inicio < ruta.length - 1 && !mejoro; inicio += 1) {
      for (let fin = inicio + 1; fin < ruta.length; fin += 1) {
        const candidata = [...ruta.slice(0, inicio), ...ruta.slice(inicio, fin + 1).reverse(), ...ruta.slice(fin + 1)];
        if (distanciaRecorrido(candidata, origen) + 0.001 < distanciaActual) {
          ruta.splice(0, ruta.length, ...candidata);
          mejoro = true;
          break;
        }
      }
    }
  }
  return ruta;
}

function claveGrupo(pedido) {
  const fecha = pedido.fechaEntrega ? new Date(pedido.fechaEntrega).toISOString().slice(0, 10) : "0000-00-00";
  return `${fecha}|${pedido.horaDesde || "99:99"}|${pedido.horaHasta || "99:99"}`;
}

function ordenarFallback(pedidos, ordenPorBarrio) {
  return [...pedidos].sort((a, b) => {
    const pa = ordenPorBarrio[a.barrio] ?? 999;
    const pb = ordenPorBarrio[b.barrio] ?? 999;
    if (pa !== pb) return pa - pb;
    const numeroA = numeroCalle(a.direccion);
    const numeroB = numeroCalle(b.direccion);
    if (numeroA !== numeroB) return numeroA - numeroB;
    return (a.id || 0) - (b.id || 0);
  });
}

// "ordenPorBarrio" es un mapa { barrio: orden } sacado de la tabla "zonas" para un camión.
// Se pasa aparte (en vez de consultar la base acá) para poder ordenar varias tandas de pedidos
// sin repetir la consulta.
function ordenarPorRuta(pedidos, ordenPorBarrio, origen) {
  const grupos = new Map();
  for (const pedido of pedidos) {
    const clave = claveGrupo(pedido);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(pedido);
  }

  return [...grupos.entries()]
    .sort(([claveA], [claveB]) => claveA.localeCompare(claveB))
    .flatMap(([, grupo]) => {
      const fallback = ordenarFallback(grupo, ordenPorBarrio);
      if (!coordenadasValidas(origen)) return fallback;
      const ubicados = fallback.filter(coordenadasValidas);
      const sinUbicar = fallback.filter((pedido) => !coordenadasValidas(pedido));
      return [...ordenarPorCercania(ubicados, origen), ...sinUbicar];
    });
}

module.exports = { coordenadasValidas, distanciaKm, ordenarPorCercania, ordenarPorRuta, numeroCalle };
