const SEGMENTOS_CLIENTE = [
  "consumo_personal",
  "dispenser_frio_calor",
  "comercio_reventa",
];

const SEGMENTO_POR_DEFECTO = "consumo_personal";

function esSegmentoValido(segmento) {
  return SEGMENTOS_CLIENTE.includes(segmento);
}

module.exports = { SEGMENTOS_CLIENTE, SEGMENTO_POR_DEFECTO, esSegmentoValido };
