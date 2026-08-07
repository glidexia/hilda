const { verificarToken } = require("../utils/jwt");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }
  try {
    req.user = verificarToken(header.split(" ")[1]);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o vencido" });
  }
}

// Uso: requireRole("admin") o requireRole("chofer")
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tenés permiso para acceder a esto" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
