const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const app = express();
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  console.log('  From:', req.ip || req.connection.remoteAddress);
  
  if (req.method === 'POST' && req.body) {
    console.log('  Body:', JSON.stringify(req.body, null, 2));
  }
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`  Response (${duration}ms):`, typeof data === 'string' ? data.substring(0, 200) : data);
    return originalSend.call(this, data);
  };
  
  next();
});

// Pikafish binary path (in Docker container)
const PIKAFISH_PATH = process.env.PIKAFISH_PATH || '/app/pikafish';

class PikafishEngine {
  constructor() {
    this.engine = null;
    this.ready = false;
    this.pendingResolve = null;
    this.lastBestMove = null;
    this.lastInfo = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      console.log(`Starting Pikafish engine at: ${PIKAFISH_PATH}`);
      
      this.engine = spawn(PIKAFISH_PATH, [], {
        cwd: path.dirname(PIKAFISH_PATH)
      });

      const rl = readline.createInterface({
        input: this.engine.stdout,
        terminal: false
      });

      rl.on('line', (line) => {
        console.log('Engine:', line);
        
        if (line.startsWith('info ')) {
          this.lastInfo = line;
        }
        
        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          this.lastBestMove = parts[1];
          if (this.pendingResolve) {
            this.pendingResolve({
              bestMove: this.lastBestMove,
              info: this.lastInfo
            });
            this.pendingResolve = null;
          }
        }
        
        if (line === 'uciok') {
          this.ready = true;
          resolve();
        }
      });

      this.engine.stderr.on('data', (data) => {
        console.error('Engine Error:', data.toString());
      });

      this.engine.on('close', (code) => {
        console.log(`Engine exited with code ${code}`);
        this.ready = false;
        // Restart engine after delay
        setTimeout(() => {
          console.log('Restarting engine...');
          this.init().catch(err => console.error('Failed to restart engine:', err));
        }, 1000);
      });

      this.engine.on('error', (err) => {
        console.error('Failed to start engine:', err);
        reject(err);
      });

      // Initialize UCI
      this.engine.stdin.write('uci\n');
    });
  }

  async analyze(fen, depth = 20, movetime = 1000) {
    return new Promise((resolve, reject) => {
      if (!this.ready) {
        reject(new Error('Engine not ready'));
        return;
      }

      this.lastBestMove = null;
      this.lastInfo = null;
      this.pendingResolve = resolve;

      // Set position
      this.engine.stdin.write(`position fen ${fen}\n`);
      
      // Start analysis
      this.engine.stdin.write(`go depth ${depth} movetime ${movetime}\n`);

      // Timeout after movetime + 2 seconds
      setTimeout(() => {
        if (this.pendingResolve) {
          if (this.lastBestMove) {
            resolve({
              bestMove: this.lastBestMove,
              info: this.lastInfo
            });
          } else {
            reject(new Error('Timeout waiting for best move'));
          }
          this.pendingResolve = null;
        }
      }, movetime + 2000);
    });
  }

  close() {
    if (this.engine) {
      this.engine.stdin.write('quit\n');
      this.engine.kill();
    }
  }
}

const engine = new PikafishEngine();

// Initialize engine
engine.init().then(() => {
  console.log('✅ Pikafish engine initialized');
}).catch(err => {
  console.error('Failed to initialize engine:', err);
  process.exit(1);
});

// API endpoint to get best move
app.post('/bestmove', async (req, res) => {
  try {
    const { fen, depth = 20, movetime = 1000 } = req.body;
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position required' });
    }

    console.log(`Analyzing: ${fen}`);
    const result = await engine.analyze(fen, depth, movetime);
    
    res.json({
      fen,
      bestMove: result.bestMove,
      info: result.info,
      depth,
      movetime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    engine: engine.ready ? 'ready' : 'not ready',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Pikafish Chinese Chess Engine API',
    version: '1.0.0',
    engine: 'Pikafish dev-20260324',
    hosted: 'Railway',
    endpoints: {
      'POST /bestmove': {
        description: 'Get best move for a position',
        body: {
          fen: 'FEN string (required)',
          depth: 'Search depth (optional, default: 20)',
          movetime: 'Thinking time in ms (optional, default: 1000)'
        },
        example: {
          fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w',
          depth: 20,
          movetime: 1000
        }
      },
      'GET /health': 'Health check'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Pikafish API running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🎮 Engine: ${PIKAFISH_PATH}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  engine.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  engine.close();
  process.exit(0);
});
