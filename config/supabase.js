const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment. Check .env file."
  );
  throw new Error("Supabase credentials are missing");
}

// Build a Supabase client. When an accessToken (user JWT) is passed, it is
// forwarded as the Authorization header so PostgreSQL Row Level Security
// enforces that user's permissions.
const createSupabase = (accessToken = null) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

// Anonymous client used for auth calls and public endpoints.
const supabase = createSupabase();

module.exports = supabase;
module.exports.createSupabase = createSupabase;