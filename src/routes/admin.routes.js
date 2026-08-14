const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const admin = require("../controllers/admin.controller");
const asyncHandler = require("../utils/asyncHandler");

// Todo lo que cuelga de acá exige estar logueado como admin
router.use(requireAuth, requireRole("admin"));

router.get("/ping", (req, res) => res.json({ ok: true, admin: req.user.nombre }));

router.get("/dashboard", asyncHandler(admin.dashboard));

router.get("/pedidos", asyncHandler(admin.listarPedidos));
router.patch("/pedidos/:id/camion", asyncHandler(admin.reasignarCamion));

router.get("/clientes", asyncHandler(admin.listarClientes));

router.get("/productos", asyncHandler(admin.listarProductosAdmin));
router.post("/productos", asyncHandler(admin.crearProducto));
router.patch("/productos/:id", asyncHandler(admin.actualizarProducto));
router.delete("/productos/:id", asyncHandler(admin.eliminarProducto));

router.get("/camiones", asyncHandler(admin.listarCamiones));
router.post("/camiones", asyncHandler(admin.crearCamion));
router.patch("/camiones/:id", asyncHandler(admin.actualizarCamion));
router.delete("/camiones/:id", asyncHandler(admin.eliminarCamion));

router.get("/zonas", asyncHandler(admin.listarZonas));
router.post("/zonas", asyncHandler(admin.crearZona));
router.patch("/zonas/:id", asyncHandler(admin.renombrarZona));
router.delete("/zonas/:id", asyncHandler(admin.eliminarZona));
router.patch("/zonas/:id/camion", asyncHandler(admin.asignarZonaACamion));

router.get("/calendario", asyncHandler(admin.listarDiasNoHabiles));
router.post("/calendario", asyncHandler(admin.agregarDiaNoHabil));
router.delete("/calendario/:id", asyncHandler(admin.quitarDiaNoHabil));

router.get("/perfil", asyncHandler(admin.obtenerPerfil));
router.patch("/perfil", asyncHandler(admin.actualizarPerfil));

router.get("/configuracion", asyncHandler(admin.obtenerConfiguracion));
router.patch("/configuracion", asyncHandler(admin.actualizarConfiguracion));

module.exports = router;
