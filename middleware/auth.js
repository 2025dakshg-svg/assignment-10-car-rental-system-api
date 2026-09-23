const supabase = require("../config/supabase");
const { createSupabase } = require("../config/supabase");

// @desc   Verify the Supabase access token from the Authorization header
// @route  Applied to all protected routes
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    // Ask Supabase (GoTrue) to verify the JWT and return the user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "Invalid, missing or expired token.",
      });
    }

    // Build an authenticated client that forwards the user's JWT, so every
    // database query in this request runs under that user's RLS policies.
    req.db = createSupabase(token);

    // Attach the verified user to the request object
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while authenticating user.",
    });
  }
};

module.exports = { authenticate };