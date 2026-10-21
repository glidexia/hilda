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
  if (pago !== "Transferencia" || adjuntaNuevo || comprobanteTransferenciaVigente(pedido)) return null;
  if (pedido?.comprobanteKey && pedido.comprobanteTipo === "Transferencia") {
    return "Como modificaste los productos, adjuntá el comprobante actualizado de la transferencia";
  }
  return "Para confirmar una transferencia, adjuntá el comprobante";
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
