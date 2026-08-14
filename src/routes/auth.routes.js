const express = require("express");
const router = express.Router();
const { loginAdmin, loginChofer } = require("../controllers/auth.controller");
const asyncHandler = require("../utils/asyncHandler");

router.post("/admin/login", asyncHandler(loginAdmin));
router.post("/chofer/login", asyncHandler(loginChofer));

module.exports = router;
