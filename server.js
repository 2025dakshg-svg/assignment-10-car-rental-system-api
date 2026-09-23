require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Import routes
const authRoutes = require("./routes/authRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const rentalRoutes = require("./routes/rentalRoutes");

// Import centralized error handlers
const { errorHandler, notFound } = require("./middleware/errorHandler");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root health check
app.get("/", (req, res) =>
  res.json({
    success: true,
    message: "Car Rental & Fleet Booking API is running.",
    endpoints: {
      auth: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login",
        profile: "GET /api/auth/profile",
      },
      vehicles: {
        list: "GET /api/vehicles?category=&status=",
        detail: "GET /api/vehicles/:id",
        create: "POST /api/vehicles",
        update: "PUT /api/vehicles/:id",
        delete: "DELETE /api/vehicles/:id",
      },
      rentals: {
        book: "POST /api/rentals",
        myBookings: "GET /api/rentals/my-bookings",
        cancel: "PATCH /api/rentals/:id/cancel",
        complete: "PATCH /api/rentals/:id/complete",
      },
    },
  })
);

// Register API routes
app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/rentals", rentalRoutes);

// 404 handler
app.use(notFound);

// Centralized error handler (always last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});