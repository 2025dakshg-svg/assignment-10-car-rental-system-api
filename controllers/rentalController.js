const supabase = require("../config/supabase");

const BOOKABLE_STATUSES = ["booked", "active"];

// Helper: inclusive day count between two DATE strings
// e.g. 2026-05-01 -> 2026-05-05 = 5 days
const countDays = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

// @desc   Book a vehicle (checks date collisions & computes total cost)
// @route  POST /api/rentals  (protected)
const createRental = async (req, res) => {
  try {
    const db = req.db || supabase;
    const { vehicle_id, start_date, end_date, customer_name, customer_email } =
      req.body;

    if (!vehicle_id || !start_date || !end_date || !customer_name || !customer_email) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide vehicle_id, start_date, end_date, customer_name and customer_email.",
      });
    }

    // Basic date validation
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start_date) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end_date)
    ) {
      return res.status(400).json({
        success: false,
        message: "Dates must be in YYYY-MM-DD format.",
      });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({
        success: false,
        message: "end_date must be on or after start_date.",
      });
    }

    // Verify the vehicle exists
    const { data: vehicle, error: vehicleError } = await db
      .from("vehicles")
      .select("*")
      .eq("id", vehicle_id)
      .maybeSingle();

    if (vehicleError) throw vehicleError;

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found.",
      });
    }

    if (vehicle.status === "maintenance") {
      return res.status(400).json({
        success: false,
        message: "Vehicle is under maintenance and cannot be booked.",
      });
    }

    // --- Date-range collision check ---
    // Two bookings overlap when:
    //   existing.start_date <= new end_date  AND  existing.end_date >= new start_date
    // Only bookings that are still booked/active can block the vehicle.
    const { data: collisions, error: collisionError } = await db
      .from("rentals")
      .select("id, start_date, end_date, status")
      .eq("vehicle_id", vehicle_id)
      .in("status", BOOKABLE_STATUSES)
      .lte("start_date", end_date)
      .gte("end_date", start_date);

    if (collisionError) throw collisionError;

    if (collisions && collisions.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Vehicle already reserved during this timeframe.",
        conflicting_rentals: collisions,
      });
    }

    // --- Billing ---
    // Server-side price calculation. The client can never set the price.
    const days = countDays(start_date, end_date);
    const total_cost = Number((days * Number(vehicle.daily_rate)).toFixed(2));

    // Create the booking
    const { data: rental, error: rentalError } = await db
      .from("rentals")
      .insert([
        {
          user_id: req.userId,
          vehicle_id,
          customer_name,
          customer_email,
          start_date,
          end_date,
          total_cost,
          status: "booked",
        },
      ])
      .select()
      .single();

    if (rentalError) throw rentalError;

    // State transition: available -> rented
    const { error: statusError } = await db
      .from("vehicles")
      .update({ status: "rented" })
      .eq("id", vehicle_id);

    if (statusError) throw statusError;

    return res.status(201).json({
      success: true,
      message: "Vehicle booked successfully.",
      data: {
        ...rental,
        days,
        daily_rate: vehicle.daily_rate,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc   List rentals for the authenticated user
// @route  GET /api/rentals/my-bookings  (protected)
const getMyBookings = async (req, res) => {
  try {
    const db = req.db || supabase;
    const { data, error } = await db
      .from("rentals")
      .select(
        "*, vehicles(id, brand, model, year, category, daily_rate, fuel_type)"
      )
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

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

// @desc   Cancel an upcoming rental of the authenticated user
// @route  PATCH /api/rentals/:id/cancel  (protected)
const cancelRental = async (req, res) => {
  try {
    const db = req.db || supabase;
    const id = Number(req.params.id);

    const { data: rental, error: findError } = await db
      .from("rentals")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (findError) throw findError;

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found.",
      });
    }

    if (rental.user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this booking.",
      });
    }

    if (rental.status !== "booked") {
      return res.status(400).json({
        success: false,
        message: "Only upcoming (booked) rentals can be cancelled.",
      });
    }

    // Is the rental in the past?
    if (new Date(rental.start_date) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a rental that has already started.",
      });
    }

    const { data: updated, error: updateError } = await db
      .from("rentals")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Free the vehicle if it has no other booked/active rentals
    const { data: otherBookings, error: otherError } = await db
      .from("rentals")
      .select("id")
      .eq("vehicle_id", rental.vehicle_id)
      .in("status", BOOKABLE_STATUSES);

    if (otherError) throw otherError;

    if (!otherBookings || otherBookings.length === 0) {
      const { error: statusError } = await db
        .from("vehicles")
        .update({ status: "available" })
        .eq("id", rental.vehicle_id);

      if (statusError) throw statusError;
    }

    return res.status(200).json({
      success: true,
      message: "Rental cancelled successfully.",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc   Complete a rental (mark car as returned, vehicle back to available)
// @route  PATCH /api/rentals/:id/complete  (protected)
const completeRental = async (req, res) => {
  try {
    const db = req.db || supabase;
    const id = Number(req.params.id);

    const { data: rental, error: findError } = await db
      .from("rentals")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (findError) throw findError;

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: "Rental not found.",
      });
    }

    if (rental.user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to complete this booking.",
      });
    }

    if (!["booked", "active"].includes(rental.status)) {
      return res.status(400).json({
        success: false,
        message: "Only booked or active rentals can be completed.",
      });
    }

    const { data: updated, error: updateError } = await db
      .from("rentals")
      .update({ status: "completed" })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Mark the car as returned -> available
    const { error: statusError } = await db
      .from("vehicles")
      .update({ status: "available" })
      .eq("id", rental.vehicle_id);

    if (statusError) throw statusError;

    return res.status(200).json({
      success: true,
      message: "Rental completed. Vehicle is now available.",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createRental,
  getMyBookings,
  cancelRental,
  completeRental,
};