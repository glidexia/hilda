const prisma = require("../db");
const { compararPassword } = require("../utils/password");
const { firmarToken } = require("../utils/jwt");

async function loginAdmin(req, res) {
  const { usuario, password } = req.body;
  const admin = await prisma.admin.findUnique({ where: { usuario } });
  if (!admin) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  const ok = await compararPassword(password, admin.passwordHash);
  if (!ok) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  const token = firmarToken({ id: admin.id, role: "admin", nombre: admin.nombre });
  res.json({ token, nombre: admin.nombre });
}

async function loginChofer(req, res) {
  const { usuario, password } = req.body;
  const chofer = await prisma.chofer.findUnique({ where: { usuario }, include: { camion: true } });
  if (!chofer || !chofer.activo) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  const ok = await compararPassword(password, chofer.passwordHash);
  if (!ok) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

  const token = firmarToken({ id: chofer.id, role: "chofer", camionId: chofer.camionId, nombre: chofer.nombre });
  res.json({ token, nombre: chofer.nombre, camion: chofer.camion.nombre });
}

module.exports = { loginAdmin, loginChofer };
