const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const { listarMisPedidos, marcarEstado } = require("../controllers/chofer.controller");

// Todo lo que cuelga de acá exige estar logueado como chofer, y cada uno solo ve lo suyo (req.user.camionId)
router.use(requireAuth, requireRole("chofer"));

router.get("/ping", (req, res) => res.json({ ok: true, camionId: req.user.camionId }));
router.get("/pedidos", listarMisPedidos);
router.patch("/pedidos/:id/estado", marcarEstado);

module.exports = router;
