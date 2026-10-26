const prisma = require("../db");

const URL_GEOCODIFICADOR = process.env.GEOCODING_URL || "https://nominatim.openstreetmap.org/search";
const VIEWBOX_CORDOBA = process.env.GEOCODING_VIEWBOX || "-64.35,-31.25,-64.05,-31.55";
const INTERVALO_MINIMO_MS = 1100;
const cacheMemoria = new Map();
const cacheZonas = new Map();
let colaConsultas = Promise.resolve();
let ultimaConsulta = 0;

function textoNormalizado(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

function claveDireccion(direccion, barrio) {
  return `${textoNormalizado(direccion).toLocaleLowerCase("es-AR")}|${textoNormalizado(barrio).toLocaleLowerCase("es-AR")}`;
}

function barrioPrincipal(barrio) {
  return textoNormalizado(barrio)
    .split("/")[0]
    .trim()
    .replace(/^zona\s+(?:norte|sur|este|oeste|centro)\s*-\s*/i, "")
    .trim();
}

function normalizarComparacion(valor) {
  return textoNormalizado(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function aliasDeZona(barrio) {
  const fragmentos = String(barrio || "")
    .split("/")
    .flatMap((fragmento) => [fragmento, ...fragmento.split(/\s+-\s+/)]);
  return [...new Set(fragmentos
    .map(normalizarComparacion)
    .map((alias) => alias.replace(/^zona\s+/, "").trim())
    .filter((alias) => alias.length >= 4 && !["norte", "sur", "este", "oeste", "centro zona"].includes(alias)))];
}

function contieneFrase(texto, frase) {
  return ` ${texto} `.includes(` ${frase} `);
}

// Relaciona el barrio que devuelve el geocodificador con las zonas operativas
// cargadas por el administrador. Ante dos coincidencias equivalentes conserva
// el orden de las zonas, que es el mismo que ve el cliente en el selector.
function detectarZonaEnResultado(resultado, barrios) {
  const domicilio = resultado?.address || {};
  const camposBarrio = [
    domicilio.neighbourhood,
    domicilio.suburb,
    domicilio.quarter,
    domicilio.city_district,
    domicilio.village,
    domicilio.town,
  ].map(normalizarComparacion).filter(Boolean);

  let mejor = null;
  barrios.forEach((barrio, indice) => {
    let puntaje = 0;
    for (const alias of aliasDeZona(barrio)) {
      for (const campo of camposBarrio) {
        if (campo === alias) puntaje = Math.max(puntaje, 1000 + alias.length);
        else if (contieneFrase(campo, alias) || contieneFrase(alias, campo)) puntaje = Math.max(puntaje, 700 + Math.min(alias.length, campo.length));
      }
    }
    if (puntaje > 0 && (!mejor || puntaje > mejor.puntaje || (puntaje === mejor.puntaje && indice < mejor.indice))) {
      mejor = { barrio, puntaje, indice };
    }
  });
  return mejor?.barrio || null;
}

function coordenadasValidas(valor) {
  if (valor?.latitud === null || valor?.latitud === undefined || valor?.latitud === "" || valor?.longitud === null || valor?.longitud === undefined || valor?.longitud === "") return false;
  const latitud = Number(valor?.latitud);
  const longitud = Number(valor?.longitud);
  return Number.isFinite(latitud) && Number.isFinite(longitud) && Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180;
}

function encolarConsulta(tarea) {
  const siguiente = colaConsultas.then(async () => {
    const espera = Math.max(0, INTERVALO_MINIMO_MS - (Date.now() - ultimaConsulta));
    if (espera) await new Promise((resolve) => setTimeout(resolve, espera));
    ultimaConsulta = Date.now();
    return tarea();
  });
  colaConsultas = siguiente.catch(() => {});
  return siguiente;
}

async function consultarNominatim(consulta) {
  return encolarConsulta(async () => {
    const url = new URL(URL_GEOCODIFICADOR);
    url.searchParams.set("q", consulta);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "3");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "ar");
    // Sin este límite Nominatim puede devolver una calle homónima de otra
    // localidad argentina. Esas coordenadas parecen válidas, pero destruyen el
    // orden del reparto. Todo domicilio comercial de La Hilda se busca dentro
    // de Córdoba Capital y su anillo inmediato.
    url.searchParams.set("viewbox", VIEWBOX_CORDOBA);
    url.searchParams.set("bounded", "1");
    const respuesta = await fetch(url, {
      headers: {
        "Accept-Language": "es-AR,es;q=0.9",
        "User-Agent": "LaHildaPedidos/1.0 (https://www.glidex.com.ar)",
        Referer: "https://lahildagua-production.up.railway.app/",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!respuesta.ok) return null;
    const resultados = await respuesta.json();
    const primero = resultados?.[0];
    const coordenadas = { latitud: Number(primero?.lat), longitud: Number(primero?.lon) };
    return coordenadasValidas(coordenadas) ? coordenadas : null;
  });
}

async function consultarNominatimDetallado(consulta, limitarACapital = false) {
  return encolarConsulta(async () => {
    const url = new URL(URL_GEOCODIFICADOR);
    url.searchParams.set("q", consulta);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "3");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "ar");
    if (limitarACapital) {
      url.searchParams.set("viewbox", VIEWBOX_CORDOBA);
      url.searchParams.set("bounded", "1");
    }
    const respuesta = await fetch(url, {
      headers: {
        "Accept-Language": "es-AR,es;q=0.9",
        "User-Agent": "LaHildaPedidos/1.0 (https://www.glidex.com.ar)",
        Referer: "https://aguaslahilda.com/",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!respuesta.ok) return [];
    const resultados = await respuesta.json();
    return Array.isArray(resultados) ? resultados : [];
  });
}

async function detectarZonaPorDireccion(direccion, barrios) {
  const domicilio = textoNormalizado(direccion);
  if (!domicilio || !Array.isArray(barrios) || barrios.length === 0) return null;
  const clave = `${normalizarComparacion(domicilio)}|${barrios.map(normalizarComparacion).join(";")}`;
  if (cacheZonas.has(clave)) {
    const guardada = cacheZonas.get(clave);
    return guardada && barrios.includes(guardada) ? guardada : null;
  }

  let detectada = null;
  try {
    const consultas = [
      [`${domicilio}, Córdoba Capital, Argentina`, true],
      [`${domicilio}, Córdoba, Argentina`, false],
    ];
    for (const [consulta, limitarACapital] of consultas) {
      const resultados = await consultarNominatimDetallado(consulta, limitarACapital);
      for (const resultado of resultados) {
        detectada = detectarZonaEnResultado(resultado, barrios);
        if (detectada) break;
      }
      if (detectada) break;
    }
  } catch {
    detectada = null;
  }
  // Las respuestas positivas se reutilizan; un fallo temporal del servicio no
  // se guarda para siempre y podrá reintentarse en el próximo uso.
  if (detectada) cacheZonas.set(clave, detectada);
  return detectada;
}

async function geocodificarDireccion(direccion, barrio = "") {
  const domicilio = textoNormalizado(direccion);
  if (!domicilio) return null;
  const clave = claveDireccion(domicilio, barrio);
  if (cacheMemoria.has(clave)) return cacheMemoria.get(clave);

  const zona = barrioPrincipal(barrio);
  const consultas = [
    zona && `${domicilio}, ${zona}, Córdoba, Argentina`,
    `${domicilio}, Córdoba, Argentina`,
  ].filter(Boolean);

  let coordenadas = null;
  for (const consulta of [...new Set(consultas)]) {
    try {
      coordenadas = await consultarNominatim(consulta);
      if (coordenadas) break;
    } catch {
      coordenadas = null;
    }
  }
  cacheMemoria.set(clave, coordenadas);
  return coordenadas;
}

async function obtenerCoordenadasPedido(direccion, barrio) {
  const existente = await prisma.pedido.findFirst({
    where: { direccion, barrio, latitud: { not: null }, longitud: { not: null } },
    select: { latitud: true, longitud: true },
    orderBy: { id: "desc" },
  });
  if (coordenadasValidas(existente)) return existente;
  return geocodificarDireccion(direccion, barrio);
}

async function asegurarCoordenadasPedidos(pedidos) {
  const grupos = new Map();
  for (const pedido of pedidos) {
    if (coordenadasValidas(pedido)) continue;
    const clave = claveDireccion(pedido.direccion, pedido.barrio);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(pedido);
  }

  for (const grupo of grupos.values()) {
    const muestra = grupo[0];
    const coordenadas = await obtenerCoordenadasPedido(muestra.direccion, muestra.barrio);
    if (!coordenadas) continue;
    await prisma.pedido.updateMany({
      where: { direccion: muestra.direccion, barrio: muestra.barrio, OR: [{ latitud: null }, { longitud: null }] },
      data: coordenadas,
    });
    for (const pedido of grupo) Object.assign(pedido, coordenadas);
  }
  return pedidos;
}

module.exports = {
  asegurarCoordenadasPedidos,
  coordenadasValidas,
  detectarZonaEnResultado,
  detectarZonaPorDireccion,
  geocodificarDireccion,
  obtenerCoordenadasPedido,
  textoNormalizado,
  barrioPrincipal,
};
