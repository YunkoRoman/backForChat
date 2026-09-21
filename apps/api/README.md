# BackForChat API

A NestJS-based chat API implementing Domain-Driven Design principles with MongoDB persistence and RabbitMQ event streaming.

## Prerequisites

- Node.js 22+
- MongoDB (local instance or Docker)
- RabbitMQ (local instance or Docker)
- Docker & Docker Compose (for containerized deployment)

## Local Development

### 1. Setup Environment

Copy the example configuration and customize as needed:

```bash
cp .env.example .env
```

Default values in `.env.example`:
- `MONGO_URI`: `mongodb://localhost:27017/chat`
- `RABBITMQ_URL`: `amqp://guest:guest@localhost:5672`
- `PORT`: `3000`
- `NODE_ENV`: `development`
- `FRONTEND_ORIGIN`: `http://localhost:5173` (Vite's default dev server port for `apps/web`)

### 2. Option A: Run Services Locally

**Install dependencies:**
```bash
npm install
```

**Start MongoDB (if not running):**
```bash
# Using Homebrew (macOS)
brew services start mongodb-community

# Or using docker
docker run -d -p 27017:27017 --name mongo mongo:latest
```

**Start RabbitMQ (if not running):**
```bash
# Using Homebrew (macOS)
brew services start rabbitmq

# Or using docker
docker run -d -p 5672:5672 -p 15672:15672 --name rabbitmq rabbitmq:3.13-management-alpine
```

**Start the API in development mode:**
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/api/v1`

### 3. Option B: Run Full Stack with Docker Compose

From the repository root, copy the compose env template and start all services (MongoDB, RabbitMQ, API, Web):

```bash
cp .env.docker .env   # or pass --env-file .env.docker to the command below
docker compose up
```

Host ports are intentionally remapped off the defaults so this doesn't collide
with services you might already be running locally (a local mongod, a local
RabbitMQ, a `npm run start:dev` on :3000):

- **API**: http://localhost:13000/api/v1 (container listens on 3000)
- **Web (Frontend)**: http://localhost:8000
- **MongoDB**: localhost:27018 (container listens on 27017)
- **RabbitMQ AMQP**: localhost:5673 (container listens on 5672)
- **RabbitMQ Management UI**: http://localhost:15673 (guest/guest, container listens on 15672)

### Cleaning Up Docker Services

```bash
docker compose down -v
```

The `-v` flag removes named volumes (data is not persisted).

## Building & Deployment

### Build for Production

```bash
npm run build
```

Produces optimized output in `dist/`

### Start Production Instance

```bash
npm run start:prod
```

Or using the Docker image directly (build context must be the repo root,
since this is an npm workspace):

```bash
docker build -f apps/api/Dockerfile -t backforchat-api .
docker run -p 3000:3000 \
  -e MONGO_URI="mongodb://mongo:27017/chat" \
  -e RABBITMQ_URL="amqp://guest:guest@rabbitmq:5672" \
  -e JWT_ACCESS_SECRET="your-secret" \
  -e JWT_REFRESH_SECRET="your-secret" \
  -e FRONTEND_ORIGIN="http://localhost:8000" \
  backforchat-api
```

## Testing

### Unit & Integration Tests

```bash
npm run test
```

Watch mode for development:
```bash
npm run test:watch
```

Coverage report:
```bash
npm run test:cov
```

### End-to-End Tests

```bash
npm run test:e2e
```

E2E tests use an in-memory MongoDB instance and do not require external services.

## Code Quality

### Lint

```bash
npm run lint
```

### Format Code

```bash
npm run format
```

## API Endpoints

The API implements the following core features:

- **Authentication**: `/api/v1/auth/register`, `/login`, `/refresh`, `/logout`
- **Users**: `GET /api/v1/users` (paginated user list)
- **Conversations**: `POST /api/v1/conversations`, `GET /api/v1/conversations`, `POST /api/v1/conversations/:id/members`
- **Messages**: `GET /api/v1/conversations/:id/messages`
- **WebSocket**: Real-time messaging and presence tracking via Socket.IO

See `openspec/specs/` for detailed API specifications.

## Architecture

This project follows **Domain-Driven Design** (DDD) with module-based layering:

```
src/
├── shared-kernel/       # Cross-cutting primitives (Result, DomainError, base interfaces)
├── identity/            # User authentication & management
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── messaging/           # Conversations & messages
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── presence/            # User online/offline tracking
│   ├── domain/
│   ├── application/
│   └── infrastructure/
└── config/              # Environment & app configuration
```

Each module is isolated with:
- **domain/**: Pure business logic (no framework dependencies)
- **application/**: Use cases orchestrating domain entities
- **infrastructure/**: Persistence (Mongoose), HTTP (NestJS controllers), WebSocket gateways

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | Yes | - | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Yes | - | Secret for access token signing (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | - | Secret for refresh token signing (min 32 chars) |
| `RABBITMQ_URL` | Yes | - | RabbitMQ connection string |
| `FRONTEND_ORIGIN` | Yes | - | Allowed CORS origin for the frontend |
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `development` | Runtime environment |

## Troubleshooting

**MongoDB connection refused**
- Ensure MongoDB is running: `mongosh --version` and `mongosh` should connect
- Check connection string in `.env` matches your setup

**RabbitMQ connection refused**
- Ensure RabbitMQ is running: `sudo service rabbitmq-server status` or `brew services list`
- Default credentials are guest/guest

**Port already in use**
- Change `PORT` in `.env` or stop the process using the port
- In Docker Compose, adjust port mappings in `docker-compose.yml`

**Out of memory errors in tests**
- The e2e tests use in-memory MongoDB which requires significant RAM
- Run with: `NODE_OPTIONS="--max-old-space-size=4096" npm run test:e2e`
