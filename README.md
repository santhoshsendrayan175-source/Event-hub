# EventHub

EventHub is a MERN event discovery and management starter. The React dashboard includes category and text search, browser-based nearby discovery, saved events, attendee registration, capacity indicators, and event publishing. The Express API provides event CRUD, geospatial nearby search, registration management, JWT account endpoints, and role-restricted user administration.

## Run locally

1. Install Node.js 20.19+ and MongoDB Community Server, or create a MongoDB Atlas cluster.
2. Copy `.env.example` to `.env` and set `MONGODB_URI`. Change `JWT_SECRET` before deploying.
3. Run `npm install` and then `npm run dev`.
4. Open `http://localhost:5173`. The API runs at `http://localhost:5000`.

The dashboard ships with sample events so the interface can be explored before MongoDB is connected. When the API first connects to an empty MongoDB database, it inserts those six samples so registrations use real database event IDs. Creating events and registrations is persisted when MongoDB is connected; otherwise the UI keeps those changes in its current session.

Use **Near me** and allow browser location access to search events within 10, 25, 50, or 100 km. Event venues are geocoded when published, and older records are backfilled on server startup. MongoDB stores event points as GeoJSON and searches them through a 2dsphere index. Geolocation requires localhost or HTTPS.

## API

- `GET /api/health`
- `GET /api/events?category=&search=&dateFrom=&dateTo=&location=&format=`
- `GET /api/events/nearby?lat=40.71&lng=-73.96&radiusKm=25`
- `POST /api/events`, `GET /api/events/:id`, `PATCH /api/events/:id`, `DELETE /api/events/:id`
- `POST /api/events/:id/register`, `GET /api/events/:id/registrations`
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/users/me`, `GET /api/users/me/registrations`, `GET /api/users` (admin)

Registration uses an atomic capacity increment and a unique event/email index to prevent overbooking and duplicate signups. For production, protect event-management routes with `requireAuth` and `requireRole`; they are public in this demo to keep local event creation frictionless.
