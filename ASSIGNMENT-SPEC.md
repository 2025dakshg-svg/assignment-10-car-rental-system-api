# Assignment 10 — Car Rental & Fleet Booking System (with Supabase)

**Course:** Back-end Development — Intermediate · **Estimated time:** 6–8 hours
**Stack:** Node.js, Express.js, Supabase (PostgreSQL + Auth), @supabase/supabase-js, dotenv, cors

## Objective & Overview

Build a production-ready **Car Rental & Vehicle Fleet Management REST API** using **Supabase**
(PostgreSQL & Auth). The API implements:

- complex **date-range overlap (collision) validation** so a vehicle can never be double-booked;
- **automatic rental price calculation** from day spans × daily rate;
- **relational joins** between cars and their reservation/booking history;
- **secure data access** using Supabase JWT tokens.

## Key Learning Outcomes

- Designing relational PostgreSQL schemas in Supabase with foreign keys, constraints and timestamps.
- Implementing **date collision checks** in SQL / through the Supabase JavaScript SDK.
- Calculating **dynamic billing totals** (`days × daily_rate`) on the backend server.
- Managing **vehicle fleet availability state transitions** (`available → booked → returned`).
- **Authenticating users** and protecting customer booking histories using Supabase Auth.

## Tech Stack & Dependencies

```bash
npm install express @supabase/supabase-js dotenv cors
npm install -D nodemon
```

## Database Schema

Run `database/schema.sql` once in the Supabase SQL Editor. It creates:

1. **`vehicles`** — fleet table with `brand, model, year, category, daily_rate, fuel_type,
   seating_capacity, status` (state: `available / booked / maintenance`), cost > 0 constraint.
2. **`rentals`** — bookings table with `user_id` (→ `auth.users`), `vehicle_id` (→ `vehicles`),
   `start_date, end_date, total_cost, status` plus `valid_date_range (end_date >= start_date)`,
   date-collision/postgres exclusion indexes)Skip helpers and **Row Level Security (RLS)** so each
   authenticated user only sees their own booking history.

## API Endpoints

### Supabase Auth

| Method | Endpoint            | Body                                                          | Codes |
| ------ | ------------------- | ------------------------------------------------------------- | ----- |
| POST   | `/api/auth/register`| `{ "email", "password", "name" }`                             | 201, 400 |
| POST   | `/api/auth/login`   | `{ "email", "password" }`                                     | 200, 401 |
| GET    | `/api/auth/profile` | — (Bearer token)                                              | 200, 401 |

### Vehicle Fleet Management

| Method | Endpoint            | Auth | Body                                        | Codes |
| ------ | ------------------- | ---- | ------------------------------------------- | ----- |
| GET    | `/api/vehicles`     | No   | `?category=SUV&status=available`            | 200   |
| GET    | `/api/vehicles/:id` | No   | —                                           | 200, 404 |
| POST   | `/api/vehicles`     | Yes  | vehicle fields                              | 201, 400 |
| PUT    | `/api/vehicles/:id` | Yes  | `{ "daily_rate", "status" }`                | 200, 404 |
| DELETE | `/api/vehicles/:id` | Yes  | —                                           | 200, 400 (active bookings) |

### Rental & Booking Operations

| Method   | Endpoint                       | Auth | Description                                            | Codes |
| -------- | ------------------------------ | ---- | ------------------------------------------------------ | ----- |
| POST     | `/api/rentals`                 | Yes  | Book a vehicle **with date-collision check** + total cost | 201, 400 |
| GET      | `/api/rentals/my-bookings`     | Yes  | List authenticated user's bookings (with vehicle join)  | 200   |
| PATCH    | `/api/rentals/:id/cancel`      | Yes  | Cancel upcoming booking (frees the vehicle)            | 200, 400 |
| PATCH    | `/api/rentals/:id/complete`    | Yes  | Mark car returned → vehicle status back to `available`  | 200, 400 |

## Testing & Validation

1. Register + login, copy the returned token, use `Authorization: Bearer <token>`.
2. Get all vehicles → add a vehicle → book it for a date range.
3. **Book the same vehicle again with an overlapping range → expect `400`
   "Vehicle already reserved during this timeframe."**
4. `GET /api/rentals/my-bookings` → only your bookings appear.

## Deployment

Deploy on **Render** (see `render.yaml`): health `/`, env vars `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
Import the `Car-Rental-API.postman_collection.json` to test every route.
