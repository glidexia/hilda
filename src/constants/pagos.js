const PAGOS_PERMITIDOS = ["Efectivo", "Transferencia"];
const COBROS_PERMITIDOS = ["Efectivo", "Transferencia", "Remito"];

function esPagoValido(pago) {
  return PAGOS_PERMITIDOS.includes(pago);
}

function validarComprobantePago(pago, tieneComprobante) {
  if (tieneComprobante && pago !== "Transferencia") {
    return "El comprobante solo corresponde a pagos por transferencia";
  }
  return null;
}

function esCobroValido(pago) {
  return COBROS_PERMITIDOS.includes(pago);
}

function admiteComprobanteCobro(pago) {
  return pago === "Transferencia" || pago === "Remito";
}

function comprobanteTransferenciaVigente(pedido) {
  if (!pedido?.comprobanteKey || pedido.comprobanteTipo !== "Transferencia") return false;
  if (!pedido.itemsActualizadosAt) return true;
  if (!pedido.comprobanteFecha) return false;
  return new Date(pedido.comprobanteFecha).getTime() >= new Date(pedido.itemsActualizadosAt).getTime();
}

function validarComprobanteCobro(pago, pedido, adjuntaNuevo = false) {
  // El chofer puede confirmar la transferencia ahora y adjuntar el comprobante
  // después. Un comprobante faltante o desactualizado se informa en pantalla,
  // pero no bloquea la entrega.
  return null;
}

module.exports = {
  PAGOS_PERMITIDOS,
  COBROS_PERMITIDOS,
  esPagoValido,
  esCobroValido,
  admiteComprobanteCobro,
  validarComprobantePago,
  comprobanteTransferenciaVigente,
  validarComprobanteCobro,
};
