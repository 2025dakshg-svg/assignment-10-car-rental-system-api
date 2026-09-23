const supabase = require("../config/supabase");

const VALID_CATEGORIES = ["Sedan", "SUV", "Luxury", "Hatchback", "Electric"];
const VALID_STATUSES = ["available", "rented", "maintenance"];

// @desc   Fetch all vehicles (supports ?category=SUV&status=available)
// @route  GET /api/vehicles  (public)
const getAllVehicles = async (req, res) => {
  try {
    const db = req.db || supabase;
    const { category, status } = req.query;

    let query = db.from("vehicles").select("*");

    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Category must be one of: ${VALID_CATEGORIES.join(", ")}`,
        });
      }
      query = query.eq("category", category);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${VALID_STATUSES.join(", ")}`,
        });
      }
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("id", { ascending: true });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc   Get vehicle details with its past rental records
// @route  GET /api/vehicles/:id  (public)
const getVehicleById = async (req, res) => {
  try {
    const db = req.db || supabase;
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle id.",
      });
    }

    // Fetch the vehicle
    const { data: vehicle, error: vehicleError } = await db
      .from("vehicles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (vehicleError) throw vehicleError;

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found.",
      });
    }

    // Relational join: fetch every rental for this vehicle
    const { data: rentals, error: rentalsError } = await db
      .from("rentals")
      .select("id, customer_name, customer_email, start_date, end_date, total_cost, status, created_at")
      .eq("vehicle_id", id)
      .order("created_at", { ascending: false });

    if (rentalsError) throw rentalsError;

    return res.status(200).json({
      success: true,
      data: {
        ...vehicle,
        rental_history: rentals || [],
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc   Add a new vehicle to the fleet (Admin)
// @route  POST /api/vehicles  (protected)
const createVehicle = async (req, res) => {
  try {
    const db = req.db || supabase;
    const {
      brand,
      model,
      year,
      category,
      daily_rate,
      fuel_type,
      seating_capacity,
      status,
    } = req.body;

    // Field validation
    if (!brand || !model || !year || !category || !daily_rate || !fuel_type) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide brand, model, year, category, daily_rate and fuel_type.",
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    if (Number(daily_rate) <= 0) {
      return res.status(400).json({
        success: false,
        message: "daily_rate must be greater than 0.",
      });
    }

    const { data, error } = await db
      .from("vehicles")
      .insert([
        {
          brand,
          model,
          year: Number(year),
          category,
          daily_rate: Number(daily_rate),
          fuel_type,
          seating_capacity: seating_capacity || 5,
          status: status && VALID_STATUSES.includes(status) ? status : "available",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: "Vehicle added to the fleet successfully.",
      data,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc   Update vehicle daily rate or status
// @route  PUT /api/vehicles/:id  (protected)
const updateVehicle = async (req, res) => {
  try {
    const db = req.db || supabase;
    const id = Number(req.params.id);
    const { daily_rate, status } = req.body;

    if (!id || Number.isNaN(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle id.",
      });
    }

    if (daily_rate === undefined && status === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide at least daily_rate or status to update.",
      });
    }

    // Verify the vehicle exists first
    const { data: existing, error: findError } = await db
      .from("vehicles")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (findError) throw findError;

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found.",
      });
    }

    const updates = {};

    if (daily_rate !== undefined) {
      if (Number(daily_rate) <= 0) {
        return res.status(400).json({
          success: false,
          message: "daily_rate must be greater than 0.",
        });
      }
      updates.daily_rate = Number(daily_rate);
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${VALID_STATUSES.join(", ")}`,
        });
      }
      updates.status = status;
    }

    const { data, error } = await db
      .from("vehicles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Vehicle updated successfully.",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc   Delete a vehicle from the fleet
// @route  DELETE /api/vehicles/:id  (protected)
const deleteVehicle = async (req, res) => {
  try {
    const db = req.db || supabase;
    const id = Number(req.params.id);

    if (!id || Number.isNaN(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle id.",
      });
    }

    // A vehicle with any rental rows cannot be deleted:
    // the rentals.vehicle_id FOREIGN KEY uses ON DELETE RESTRICT.
    const { data: rentals, error: bookingError } = await db
      .from("rentals")
      .select("id")
      .eq("vehicle_id", id)
      .limit(1);

    if (bookingError) throw bookingError;

    if (rentals && rentals.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete vehicle. It has rental history / active bookings. Mark it as 'maintenance' instead.",
      });
    }

    const { data, error } = await db
      .from("vehicles")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found.",
        });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle deleted from the fleet successfully.",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
};