const express = require("express");
const router = express.Router();
const { loginAdmin, loginChofer } = require("../controllers/auth.controller");

router.post("/admin/login", loginAdmin);
router.post("/chofer/login", loginChofer);

module.exports = router;
