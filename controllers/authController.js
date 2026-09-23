const supabase = require("../config/supabase");

// @desc   Register a customer with Supabase Auth
// @route  POST /api/auth/register
const register = async (req, res) => {
  try {
    const db = req.db || supabase;
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, password and name.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    // 1. Create the user in Supabase Auth (auth.users)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      // Supabase returns 400 with "already registered" style messages
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const user = data.user;

    // 2. Persist the display name in the user_metadata so we can
    //    return it on future logins.
    if (!user.identities || user.identities.length === 0) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    await supabase.auth.updateUser({
      data: { name },
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully. You can now log in.",
      data: {
        id: user.id,
        email: user.email,
        name: name || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc   Login a customer and return a Supabase access token (JWT)
// @route  POST /api/auth/login
const login = async (req, res) => {
  try {
    const db = req.db || supabase;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password.",
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Please check email and password.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc   Get the profile of the currently logged-in user
// @route  GET /api/auth/profile  (protected)
const getProfile = async (req, res) => {
  try {
    const db = req.db || supabase;
    const { data, error } = await db
      .from("profiles")
      .select("id, email, name")
      .eq("id", req.userId)
      .maybeSingle();

    // If no profile row exists, fall back to the token's user data
    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully.",
      data: {
        id: req.userId,
        email: req.user.email,
        name: req.user.user_metadata?.name || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { register, login, getProfile };