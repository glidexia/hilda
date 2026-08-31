const PAGOS_PERMITIDOS = ["Efectivo", "Transferencia"];

function esPagoValido(pago) {
  return PAGOS_PERMITIDOS.includes(pago);
}

function validarComprobantePago(pago, tieneComprobante) {
  if (tieneComprobante && pago !== "Transferencia") {
    return "El comprobante solo corresponde a pagos por transferencia";
  }
  return null;
}

module.exports = { PAGOS_PERMITIDOS, esPagoValido, validarComprobantePago };
