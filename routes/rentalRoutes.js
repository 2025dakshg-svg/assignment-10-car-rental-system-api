const express = require("express");
const router = express.Router();
const {
  createRental,
  getMyBookings,
  cancelRental,
  completeRental,
} = require("../controllers/rentalController");
const { authenticate } = require("../middleware/auth");

// POST /api/rentals  (protected)
router.post("/", authenticate, createRental);

// GET /api/rentals/my-bookings  (protected)
router.get("/my-bookings", authenticate, getMyBookings);

// PATCH /api/rentals/:id/cancel  (protected)
router.patch("/:id/cancel", authenticate, cancelRental);

// PATCH /api/rentals/:id/complete  (protected)
router.patch("/:id/complete", authenticate, completeRental);

module.exports = router;