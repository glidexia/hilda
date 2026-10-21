const URL_MATRIZ_POR_DEFECTO = "https://routing.openstreetmap.de/routed-car/table/v1/driving";
const MAXIMO_PUNTOS = Math.min(100, Math.max(2, Number(process.env.ROUTING_MAX_POINTS) || 50));
const DURACION_CACHE_MS = 10 * 60 * 1000;
const ESPERA_ENTRE_SOLICITUDES_MS = 1100;
const TIMEOUT_MS = 12000;

const cache = new Map();
const enCurso = new Map();
let cola = Promise.resolve();
let proximoTurno = 0;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ejecutarLimitado(tarea) {
  const ejecucion = cola.then(async () => {
    const demora = Math.max(0, proximoTurno - Date.now());
    if (demora) await esperar(demora);
    try {
      return await tarea();
    } finally {
      proximoTurno = Date.now() + ESPERA_ENTRE_SOLICITUDES_MS;
    }
  });
  cola = ejecucion.catch(() => null);
  return ejecucion;
}

function clavePuntos(puntos) {
  return puntos.map((punto) => `${Number(punto.longitud).toFixed(6)},${Number(punto.latitud).toFixed(6)}`).join(";");
}

function limpiarCacheVencida() {
  const ahora = Date.now();
  for (const [clave, valor] of cache) if (valor.vence <= ahora) cache.delete(clave);
}

async function consultarMatriz(puntos) {
  const base = String(process.env.ROUTING_TABLE_URL || URL_MATRIZ_POR_DEFECTO).replace(/\/+$/, "");
  const coordenadas = clavePuntos(puntos);
  const url = `${base}/${coordenadas}?annotations=duration,distance`;
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const respuesta = await fetch(url, {
      signal: controlador.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "LaHildaPedidos/1.0 (https://aguaslahilda.com/)",
        Referer: "https://aguaslahilda.com/",
      },
    });
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    if (datos?.code !== "Ok" || !Array.isArray(datos.durations)) return null;
    const dimension = puntos.length;
    if (datos.durations.length !== dimension || datos.durations.some((fila) => !Array.isArray(fila) || fila.length !== dimension || fila.some((valor) => valor === null || valor === "" || !Number.isFinite(Number(valor))))) return null;
    return datos.durations;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function obtenerMatrizRuta(puntos) {
  if (!Array.isArray(puntos) || puntos.length < 2 || puntos.length > MAXIMO_PUNTOS) return null;
  if (puntos.some((punto) => {
    const latitud = Number(punto?.latitud);
    const longitud = Number(punto?.longitud);
    return !Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180;
  })) return null;

  limpiarCacheVencida();
  const clave = clavePuntos(puntos);
  const guardada = cache.get(clave);
  if (guardada) return guardada.matriz;
  if (enCurso.has(clave)) return enCurso.get(clave);

  const promesa = ejecutarLimitado(() => consultarMatriz(puntos))
    .then((matriz) => {
      if (matriz) cache.set(clave, { matriz, vence: Date.now() + DURACION_CACHE_MS });
      return matriz;
    })
    .finally(() => enCurso.delete(clave));
  enCurso.set(clave, promesa);
  return promesa;
}

module.exports = { obtenerMatrizRuta };
