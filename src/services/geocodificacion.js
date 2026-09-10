const prisma = require("../db");

const URL_GEOCODIFICADOR = process.env.GEOCODING_URL || "https://nominatim.openstreetmap.org/search";
const INTERVALO_MINIMO_MS = 1100;
const cacheMemoria = new Map();
let colaConsultas = Promise.resolve();
let ultimaConsulta = 0;

function textoNormalizado(valor) {
  return String(valor || "").trim().replace(/\s+/g, " ");
}

function claveDireccion(direccion, barrio) {
  return `${textoNormalizado(direccion).toLocaleLowerCase("es-AR")}|${textoNormalizado(barrio).toLocaleLowerCase("es-AR")}`;
}

function barrioPrincipal(barrio) {
  return textoNormalizado(barrio).split("/")[0].trim();
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
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "ar");
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
  geocodificarDireccion,
  obtenerCoordenadasPedido,
  textoNormalizado,
};
