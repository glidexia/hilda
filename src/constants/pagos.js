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

function requiereComprobanteCobro(pago) {
  return pago === "Transferencia" || pago === "Remito";
}

module.exports = { PAGOS_PERMITIDOS, COBROS_PERMITIDOS, esPagoValido, esCobroValido, requiereComprobanteCobro, validarComprobantePago };
