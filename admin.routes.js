const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const admin = require("../controllers/admin.controller");

// Todo lo que cuelga de acá exige estar logueado como admin
router.use(requireAuth, requireRole("admin"));

router.get("/ping", (req, res) => res.json({ ok: true, admin: req.user.nombre }));

router.get("/dashboard", admin.dashboard);

router.get("/pedidos", admin.listarPedidos);
router.patch("/pedidos/:id/camion", admin.reasignarCamion);

router.get("/clientes", admin.listarClientes);

router.get("/productos", admin.listarProductosAdmin);
router.post("/productos", admin.crearProducto);
router.patch("/productos/:id", admin.actualizarProducto);

router.get("/camiones", admin.listarCamiones);
router.post("/camiones", admin.crearCamion);
router.patch("/camiones/:id", admin.actualizarCamion);
router.get("/zonas", admin.listarZonas);
router.post("/zonas", admin.crearZona);
router.patch("/zonas/:id", admin.renombrarZona);
router.delete("/zonas/:id", admin.eliminarZona);
router.patch("/zonas/:id/camion", admin.asignarZonaACamion);

router.get("/calendario", admin.listarDiasNoHabiles);
router.post("/calendario", admin.agregarDiaNoHabil);
router.delete("/calendario/:id", admin.quitarDiaNoHabil);

module.exports = router;
