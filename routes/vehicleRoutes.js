const express = require("express");
const router = express.Router();
const {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} = require("../controllers/vehicleController");
const { authenticate } = require("../middleware/auth");

// GET /api/vehicles  (public)
router.get("/", getAllVehicles);

// GET /api/vehicles/:id  (public)
router.get("/:id", getVehicleById);

// POST /api/vehicles  (protected)
router.post("/", authenticate, createVehicle);

// PUT /api/vehicles/:id  (protected)
router.put("/:id", authenticate, updateVehicle);

// DELETE /api/vehicles/:id  (protected)
router.delete("/:id", authenticate, deleteVehicle);

module.exports = router;