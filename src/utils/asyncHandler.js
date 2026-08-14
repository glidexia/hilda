// Envuelve un handler de ruta async: si tira un error, en vez de crashear el proceso
// (lo que pasaba antes — un error sin atrapar en una promesa podía derribar el servidor entero),
// lo pasa a errorHandler.js para que responda con un JSON prolijo y el servidor siga vivo.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
