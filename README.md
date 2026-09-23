# 🚗 Assignment 10 — Car Rental & Fleet Booking API (Supabase)

A production-ready **Car Rental & Fleet Management REST API** built with **Node.js**, **Express.js**, and **Supabase** (PostgreSQL Cloud DB + Auth). It implements **date-range overlap validations** to prevent double-booking, **automatic rental price calculations** based on day spans, **relational joins** between cars and reservation histories, and **secure data access** using Supabase JWT tokens with PostgreSQL Row Level Security.

---

## 1. Features

- 🔐 **Supabase Auth** — register & login, returns a real Supabase access token (JWT)
- 🛡️ **Route Guards** — protected endpoints verify the Bearer token with `supabase.auth.getUser()`
- 🗄️ **Relational schema** — `vehicles` × `rentals` with foreign keys, check constraints, and timestamps
- ⛔ **Date collision prevention** — overlapping bookings (`start ≤ existing_end  AND  end ≥ existing_start`) are rejected with `400`
- 💰 **Server-side billing** — `total_cost = days × daily_rate`, the client can never set the price
- 🚗 **Fleet state machine** — `available → rented → available` (and `maintenance`)
- 👤 **Booking history protection** — users only see their own bookings; RLS enforces it at the database level
- 📄 **Public fleet browsing** — `GET /api/vehicles` with `category` / `status` filters, no login needed

## 2. Tech Stack

| Layer      | Technology                        |
| ---------- | --------------------------------- |
| Runtime    | Node.js                           |
| Framework  | Express.js                        |
| Database   | Supabase (PostgreSQL)             |
| DB Access  | @supabase/supabase-js             |
| Auth       | Supabase Auth (GoTrue) + JWT      |
| Security   | PostgreSQL Row Level Security     |
| Env vars   | dotenv                            |
| CORS       | cors                              |
| Dev server | nodemon                           |

## 3. Folder Structure

```
assignment-10-car-rental-api/
│
├── config/
│   └── supabase.js           # Supabase client connection
│
├── controllers/
│   ├── authController.js     # Supabase Auth logic (register/login/profile)
│   ├── rentalController.js   # Booking calculation & collision prevention
│   └── vehicleController.js  # Vehicle CRUD & fleet filters
│
├── middleware/
│   ├── auth.js               # Verify Supabase Bearer token + attach JWT session
│   └── errorHandler.js       # Centralized error handler + 404
│
├── routes/
│   ├── authRoutes.js
│   ├── rentalRoutes.js
│   └── vehicleRoutes.js
│
├── database/
│   └── schema.sql            # Run this once in the Supabase SQL Editor
│
├── .env.example
├── .gitignore
├── package.json
├── render.yaml               # One-click Render deployment blueprint
├── server.js
├── README.md
└── Car-Rental-API.postman_collection.json
```

## 4. Setup

### 4.1 Create the Supabase project & database

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. Open **SQL Editor** → **New query**, paste the whole `database/schema.sql` file, and run it.
   This creates the `vehicles` and `rentals` tables, RLS policies, a `profiles` sync trigger, and 3 sample vehicles.
3. Copy your project URL + anon key from **Project Settings → API**.

### 4.2 Run the server

```bash
npm install
cp .env.example .env     # paste your SUPABASE_URL and SUPABASE_ANON_KEY
npm run dev
```

Server runs on `http://localhost:5000` (or `PORT`).

## 5. API Endpoints

### 🔐 Supabase Auth

| Method | Endpoint            | Body                          | Success | Errors |
| ------ | ------------------- | ----------------------------- | ------- | ------ |
| POST   | `/api/auth/register`| `{ "email", "password", "name" }` | `201`   | `400`  |
| POST   | `/api/auth/login`   | `{ "email", "password" }`     | `200` + token | `401`  |
| GET    | `/api/auth/profile` | — (Bearer token required)     | `200`   | `401`  |

### 🚗 Vehicle Fleet

| Method | Endpoint         | Auth | Description                                         |
| ------ | ---------------- | ---- | --------------------------------------------------- |
| GET    | `/api/vehicles`  | No   | All vehicles; supports `?category=SUV&status=available` |
| GET    | `/api/vehicles/:id` | No | Vehicle details **with past rental records** (join) |
| POST   | `/api/vehicles`  | Yes  | Add a vehicle to the fleet                          |
| PUT    | `/api/vehicles/:id` | Yes | Update `daily_rate` and/or `status`               |
| DELETE | `/api/vehicles/:id` | Yes | Delete vehicle (**400** if it has active bookings) |

`POST /api/vehicles` body:
```json
{
  "brand": "Tesla",
  "model": "Model 3",
  "year": 2024,
  "category": "Electric",
  "daily_rate": 4500,
  "fuel_type": "EV",
  "seating_capacity": 5
}
```

### 📅 Rentals & Bookings (all protected)

| Method   | Endpoint                     | Description                                           |
| -------- | ---------------------------- | ----------------------------------------------------- |
| POST     | `/api/rentals`               | Book a vehicle — checks date collisions & computes cost |
| GET      | `/api/rentals/my-bookings`   | List the authenticated user's bookings (joins vehicle info) |
| PATCH    | `/api/rentals/:id/cancel`    | Cancel an upcoming rental (**400** if not allowed)    |
| PATCH    | `/api/rentals/:id/complete`  | Mark car as returned; vehicle goes back to `available` |

`POST /api/rentals` body:
```json
{
  "vehicle_id": 1,
  "start_date": "2026-05-01",
  "end_date": "2026-05-05",
  "customer_name": "David",
  "customer_email": "david@test.com"
}
```

Use the token from login as `Authorization: Bearer <token>` on every protected call.

## 6. Collision Prevention Algorithm

For a new booking `S…E` on a vehicle, the server queries:

```sql
WHERE vehicle_id = :vehicle_id
  AND status IN ('booked', 'active')
  AND start_date <= :E
  AND end_date   >= :S
```

Any match means the timeframe is already taken → `400 Vehicle already reserved during this timeframe.` (the conflicting bookings are returned to help debugging).

**Billing:** `days = (end_date − start_date) + 1` (inclusive) then `total_cost = days × daily_rate`, both stored and returned from the server only.

## 7. Testing Guide (required for grading)

1. Insert 3 vehicles via the seed data (already in `schema.sql`).
2. `POST /api/auth/register` → `login` → copy the token.
3. Book **Vehicle #1** for `2026-05-01 → 2026-05-05` → expect `201`.
4. Book **Vehicle #1** again for `2026-05-03 → 2026-05-07` → expect `400` "Vehicle already reserved during this timeframe."
5. `GET /api/rentals/my-bookings` shows only your bookings.
6. `PATCH /api/rentals/:id/complete` puts the vehicle back to `available`.

All of these are pre-built in `Car-Rental-API.postman_collection.json`.

## 8. Deployment (Render)

1. Push this folder to GitHub (repo name: `itm-assignment-10-car-rental-api`).
2. On [render.com](https://render.com) → **New → Blueprint** → connect the repo. The `render.yaml` is detected automatically.
3. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as secret env vars.

## 9. Grading Rubric Map

| Criteria                                          | Where |
| ------------------------------------------------- | ----- |
| PostgreSQL / Supabase Schema & Foreign Key Constraints | `database/schema.sql` |
| Date Range Collision Prevention Algorithm         | `controllers/rentalController.js` → `createRental` |
| Automated Day Count & Cost Billing Computation    | `controllers/rentalController.js` → `countDays` |
| Supabase Authentication & Route Guards            | `middleware/auth.js` + all routes |
| Architecture, Error Handling & API Documentation  | folder structure, `middleware/errorHandler.js`, this README + Postman |

---
*itm-assignment-10-car-rental-api*