const VIGENCIA_MS = 2 * 60 * 1000;
const ubicaciones = new Map();

function actualizarUbicacion(camionId, datos) {
  const ubicacion = {
    camionId: Number(camionId),
    // Unos metros de precisión alcanzan para el reparto y evitan recalcular
    // toda la ruta por el ruido normal del GPS cuando el vehículo está quieto.
    latitud: Number(Number(datos.latitud).toFixed(5)),
    longitud: Number(Number(datos.longitud).toFixed(5)),
    precisionMetros: Number.isFinite(Number(datos.precisionMetros)) ? Math.round(Number(datos.precisionMetros)) : null,
    actualizadoEn: new Date().toISOString(),
  };
  ubicaciones.set(ubicacion.camionId, ubicacion);
  return ubicacion;
}

function obtenerUbicacion(camionId) {
  const ubicacion = ubicaciones.get(Number(camionId));
  if (!ubicacion) return null;
  if (Date.now() - new Date(ubicacion.actualizadoEn).getTime() > VIGENCIA_MS) {
    ubicaciones.delete(Number(camionId));
    return null;
  }
  return ubicacion;
}

function listarUbicaciones() {
  return [...ubicaciones.keys()].map(obtenerUbicacion).filter(Boolean);
}

function quitarUbicacion(camionId) {
  const anterior = obtenerUbicacion(camionId);
  ubicaciones.delete(Number(camionId));
  return anterior;
}

module.exports = { actualizarUbicacion, obtenerUbicacion, listarUbicaciones, quitarUbicacion };
