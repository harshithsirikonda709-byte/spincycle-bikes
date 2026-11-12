# SpinCycle Bikes – Campus Bike Share Management System

A RESTful backend API built with **Node.js**, **Express.js**, and **SQLite** for managing campus bike share riders, bicycles, and rentals.

- **Course:** Backend Development Fundamentals
- **LG Group:** NU-AIAGAI2C-G03
- **GitHub Repository:** https://github.com/harshithsirikonda709-byte/spincycle-bikes

---

## LG Group Members (NU-AIAGAI2C-G03)

1. HARSHITH
2. PRAVEEN VARMA
3. AKHIL
4. KRISHNA HARSHA
5. ASHRAF
6. ASHOK

---

## Tech Stack

- **Runtime:** Node.js
- **Web Framework:** Express.js
- **Database:** SQLite (`sqlite3`) with `PRAGMA foreign_keys = ON`
- **API Testing:** Postman Collection v2.1 & Node.js built-in test runner (`node --test`)

---

## Project Architecture

```text
spincycle-bikes/
├── package.json
├── README.md
├── postman/
│   └── SpinCycle_Bikes.postman_collection.json
├── src/
│   ├── app.js                     # Express app wiring & middleware setup
│   ├── server.js                  # Server startup & graceful shutdown
│   ├── db/
│   │   ├── database.js            # SQLite connection, FK pragma, schema init, transactions
│   │   ├── riderModel.js          # Parameterized SQL queries for riders
│   │   ├── bikeModel.js           # Parameterized SQL queries & auto bike_code logic
│   │   └── rentalModel.js         # Parameterized SQL queries & JOIN rental details
│   ├── controllers/
│   │   ├── riderController.js     # Rider request validation & handlers
│   │   ├── bikeController.js      # Bike CRUD, query search & bike_code protection
│   │   └── rentalController.js    # Rental booking, return & business rule enforcement
│   ├── routes/
│   │   ├── riderRoutes.js         # /riders endpoints
│   │   ├── bikeRoutes.js          # /bikes endpoints
│   │   └── rentalRoutes.js        # /rentals endpoints
│   ├── middleware/
│   │   └── errorHandler.js        # AppError class, 404 handler, centralized error handler
│   └── utils/
│       └── validators.js          # Shared input validation helpers
└── tests/
    └── api.test.js                # Automated integration tests
```

---

## Database Schema

SQLite foreign keys are enabled on startup via `PRAGMA foreign_keys = ON`.

1. **`riders`**
   - `id` (`INTEGER PRIMARY KEY AUTOINCREMENT`)
   - `name` (`TEXT NOT NULL`)
   - `phone` (`TEXT NOT NULL`)

2. **`bikes`**
   - `id` (`INTEGER PRIMARY KEY AUTOINCREMENT`)
   - `bike_code` (`TEXT NOT NULL UNIQUE`) — Server-generated (`BKE-0001`, `BKE-0002`, ...)
   - `name` (`TEXT NOT NULL`)
   - `type` (`TEXT NOT NULL`)
   - `status` (`TEXT NOT NULL DEFAULT 'available'`) — Allowed: `available`, `rented`, `maintenance`

3. **`rentals`**
   - `id` (`INTEGER PRIMARY KEY AUTOINCREMENT`)
   - `rider_id` (`INTEGER NOT NULL`, `FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE RESTRICT`)
   - `bike_id` (`INTEGER NOT NULL`, `FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE RESTRICT`)
   - `rental_date` (`TEXT NOT NULL`)
   - `return_date` (`TEXT`, nullable — `NULL` indicates an active rental)

---

## Automatic Bike Code Generation Rules

- The first created bike receives `BKE-0001`, the second receives `BKE-0002`, and so on sequentially.
- `bike_code` is generated atomically inside a SQLite `IMMEDIATE` transaction from `AUTOINCREMENT` row IDs (`sqlite_sequence`), guaranteeing:
  - Sequential, unique codes (`BKE-0001`, `BKE-0002`, ...).
  - Codes are **never reused** even after deleting bikes or restarting the server.
- Sending `bike_code` in `POST /bikes` or `PUT /bikes/:id` is rejected with `400 Bad Request`.
- `bike_code` is never included in SQL `UPDATE` queries.

---

## Setup & Running Locally

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

The server starts on `http://localhost:3000` by default (override with `PORT` and `DB_PATH` environment variables if needed). The SQLite database file is created automatically at `data/spincycle.db`.

For auto-reload during development:

```bash
npm run dev
```

### 3. Run Automated Integration Tests

```bash
npm test
```

---

## API Endpoints

### Riders

| Method | Endpoint  | Description       | Success Status |
| ------ | --------- | ----------------- | -------------- |
| `GET`  | `/riders` | List all riders   | `200 OK`       |
| `POST` | `/riders` | Create a new rider| `201 Created`  |

**Example `POST /riders`:**
```json
{
  "name": "Alice Morgan",
  "phone": "+1 555-0101"
}
```

---

### Bikes

| Method   | Endpoint              | Description                           | Success Status |
| -------- | --------------------- | ------------------------------------- | -------------- |
| `GET`    | `/bikes`              | List all bikes                        | `200 OK`       |
| `GET`    | `/bikes?type=Mountain`| Search bikes by type (case-insensitive)| `200 OK`      |
| `GET`    | `/bikes/:id`          | Get a single bike by ID               | `200 OK`       |
| `POST`   | `/bikes`              | Create a bike (auto-generates code)   | `201 Created`  |
| `PUT`    | `/bikes/:id`          | Update bike (`name`, `type`, `status`)| `200 OK`       |
| `DELETE` | `/bikes/:id`          | Delete a bike (blocked if rented)     | `200 OK`       |

**Example `POST /bikes`:**
```json
{
  "name": "Summit X1",
  "type": "Mountain"
}
```

**Example `PUT /bikes/1`:**
```json
{
  "name": "Summit X1 Pro",
  "type": "Mountain",
  "status": "maintenance"
}
```

**Example `GET /bikes?type=Mountain`:**
```bash
curl "http://localhost:3000/bikes?type=Mountain"
```

**Example `DELETE /bikes/2` response (`200 OK`):**
```json
{
  "message": "Bike deleted successfully",
  "bike": {
    "id": 2,
    "bike_code": "BKE-0002",
    "name": "City Glider",
    "type": "Hybrid",
    "status": "available"
  }
}
```

---

### Rentals

| Method  | Endpoint               | Description                                        | Success Status |
| ------- | ---------------------- | -------------------------------------------------- | -------------- |
| `GET`   | `/rentals`             | List all rentals                                   | `200 OK`       |
| `POST`  | `/rentals`             | Create a rental (prevents duplicate active rentals)| `201 Created`  |
| `GET`   | `/rentals/details`     | List rentals joined with rider and bike names      | `200 OK`       |
| `PATCH` | `/rentals/:id/return`  | Mark an active rental as returned                  | `200 OK`       |

**Example `POST /rentals`:**
```json
{
  "rider_id": 1,
  "bike_id": 1
}
```

**Example `GET /rentals/details` response item:**
```json
{
  "id": 1,
  "rider_id": 1,
  "rider_name": "Alice Morgan",
  "rider_phone": "+1 555-0101",
  "bike_id": 1,
  "bike_code": "BKE-0001",
  "bike_name": "Summit X1",
  "bike_type": "Mountain",
  "bike_status": "rented",
  "rental_date": "2026-11-11T10:00:00.000Z",
  "return_date": null
}
```

**Example `PATCH /rentals/1/return`:**
```json
{}
```

---

## HTTP Status Codes

- `200 OK` — Successful `GET`, `PUT`, `PATCH`, or `DELETE` request
- `201 Created` — Resource successfully created (`POST /riders`, `POST /bikes`, `POST /rentals`)
- `400 Bad Request` — Invalid input, malformed JSON, invalid ID, or client-supplied `bike_code`
- `404 Not Found` — Requested route, rider, bike, or rental does not exist
- `409 Conflict` — Duplicate active rental, renting a bike under maintenance, deleting a rented bike or bike with rental history, or invalid status change on a rented bike
- `500 Internal Server Error` — Unexpected server error

---

## Testing with Postman

1. Start the server with `npm start`.
2. Open Postman and click **Import**.
3. Select `postman/SpinCycle_Bikes.postman_collection.json`.
4. Open the **SpinCycle Bikes** collection and click **Run** (Collection Runner) to execute all endpoint requests and automated test assertions in sequence.

