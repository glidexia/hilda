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

function matrizValida(matriz, cantidadPedidos) {
  const dimension = cantidadPedidos + 1;
  return Array.isArray(matriz)
    && matriz.length === dimension
    && matriz.every((fila) => Array.isArray(fila)
      && fila.length === dimension
      && fila.every((valor) => valor !== null && valor !== "" && Number.isFinite(Number(valor)) && Number(valor) >= 0));
}

// Ordena usando tiempos reales de manejo provistos por un motor de calles.
// La matriz incluye al galpón en el índice 0 y a cada pedido desde el índice 1.
// En cada paso elige estrictamente la parada más cercana por tiempo de manejo
// desde la ubicación actual. No reordena luego para acortar el circuito total:
// el chofer y el cliente necesitan que 1, 2, 3... expresen cercanía sucesiva.
function ordenarPorMatriz(pedidos, matriz) {
  if (!matrizValida(matriz, pedidos.length)) return null;

  const pendientes = pedidos.map((pedido, indice) => ({ pedido, indice: indice + 1 }));
  const ruta = [];
  let actual = 0;
  while (pendientes.length) {
    let mejorIndice = 0;
    let mejorCosto = Number(matriz[actual][pendientes[0].indice]);
    for (let i = 1; i < pendientes.length; i += 1) {
      const costo = Number(matriz[actual][pendientes[i].indice]);
      if (costo < mejorCosto || (costo === mejorCosto && (pendientes[i].pedido.id || 0) < (pendientes[mejorIndice].pedido.id || 0))) {
        mejorIndice = i;
        mejorCosto = costo;
      }
    }
    const siguiente = pendientes.splice(mejorIndice, 1)[0];
    ruta.push(siguiente);
    actual = siguiente.indice;
  }

  return ruta.map((parada) => parada.pedido);
}

// Respaldo sin motor de calles: parte del galpón y enlaza siempre la parada
// geográficamente más cercana desde la ubicación anterior.
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

// Variante asíncrona: obtiene una sola matriz de calles para todos los pedidos
// del camión y reutiliza sus submatrices sin mezclar fechas ni franjas horarias.
// Si el ruteador externo no responde, conserva automáticamente la heurística
// geográfica anterior y, para domicilios sin coordenadas, el orden zona/calle.
async function ordenarPorRutaConCalles(pedidos, ordenPorBarrio, origen, obtenerMatriz) {
  const grupos = new Map();
  for (const pedido of pedidos) {
    const clave = claveGrupo(pedido);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(pedido);
  }

  const gruposOrdenados = [...grupos.entries()]
    .sort(([claveA], [claveB]) => claveA.localeCompare(claveB))
    .map(([clave, grupo]) => ({ clave, fallback: ordenarFallback(grupo, ordenPorBarrio) }));

  if (!coordenadasValidas(origen)) return gruposOrdenados.flatMap(({ fallback }) => fallback);

  if (typeof obtenerMatriz !== "function") {
    return gruposOrdenados.flatMap(({ fallback }) => {
      const ubicados = fallback.filter(coordenadasValidas);
      const sinUbicar = fallback.filter((pedido) => !coordenadasValidas(pedido));
      return [...ordenarPorCercania(ubicados, origen), ...sinUbicar];
    });
  }

  const ubicadosTotales = gruposOrdenados.flatMap(({ fallback }) => fallback.filter(coordenadasValidas));
  let matrizCompleta = null;
  try {
    if (ubicadosTotales.length > 1) matrizCompleta = await obtenerMatriz([origen, ...ubicadosTotales]);
  } catch (_) {
    matrizCompleta = null;
  }
  const indiceGlobal = new Map(ubicadosTotales.map((pedido, indice) => [pedido, indice + 1]));
  const matrizCompletaValida = matrizValida(matrizCompleta, ubicadosTotales.length);

  return gruposOrdenados.flatMap(({ fallback }) => {
    const ubicados = fallback.filter(coordenadasValidas);
    const sinUbicar = fallback.filter((pedido) => !coordenadasValidas(pedido));
    if (!matrizCompletaValida || ubicados.length < 2) return [...ordenarPorCercania(ubicados, origen), ...sinUbicar];

    const indices = [0, ...ubicados.map((pedido) => indiceGlobal.get(pedido))];
    const submatriz = indices.map((fila) => indices.map((columna) => matrizCompleta[fila][columna]));
    const porCalles = ordenarPorMatriz(ubicados, submatriz);
    return [...(porCalles || ordenarPorCercania(ubicados, origen)), ...sinUbicar];
  });
}

module.exports = { coordenadasValidas, distanciaKm, ordenarPorCercania, ordenarPorMatriz, ordenarPorRuta, ordenarPorRutaConCalles, numeroCalle };
