function errorHandler(err, req, res, next) {
  console.error(err);
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "La imagen puede pesar hasta 5 MB" });
  }
  if (err?.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: "Revisá el archivo seleccionado" });
  }
  const status = Number.isInteger(err.status) ? err.status : 500;
  const mensaje = status >= 500
    ? "No pudimos completar la acción. Intentá nuevamente en unos minutos."
    : (err.message || "No pudimos completar la acción");
  res.status(status).json({ error: mensaje });
}

module.exports = errorHandler;
