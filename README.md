# Pikafish Chinese Chess Engine API

A REST API for the Pikafish Chinese Chess (象棋/Xiangqi) engine.

## Endpoints

### `GET /`
API info and available endpoints

### `GET /health`
Health check endpoint

### `POST /bestmove`
Get the best move for a position

**Request body:**
```json
{
  "fen": "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w",
  "depth": 20,
  "movetime": 1000
}
```

**Response:**
```json
{
  "fen": "...",
  "bestMove": "c3c4",
  "info": "info depth 20 ...",
  "depth": 20,
  "movetime": 1000,
  "timestamp": "2026-03-29T00:00:00.000Z"
}
```

## Deployment

This API is designed to be deployed on Railway.app using Docker.

### Deploy to Railway

1. Push this repo to GitHub
2. Create a new project on Railway
3. Deploy from GitHub repo
4. Railway will automatically build the Docker image and deploy

## Local Development

```bash
# Build Docker image
docker build -t pikafish-api .

# Run container
docker run -p 3000:3000 pikafish-api

# Test
curl http://localhost:3000/health
```

## Environment Variables

- `PORT` - Server port (default: 3000, Railway sets this automatically)
- `PIKAFISH_PATH` - Path to Pikafish binary (default: /app/pikafish)

## License

MIT
