import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import ticketsRouter from './routes/tickets.js';
import configRouter from './routes/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LogMessage {
  type: 'log' | 'error' | 'clear' | 'connected';
  timestamp: number;
  ticketId?: string;
  data: string;
  ansiColor?: boolean;
}

export class WebServer {
  private static instance: WebServer | null = null;
  private app: express.Application;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    WebServer.instance = this;
  }

  public static getInstance(): WebServer | null {
    return WebServer.instance;
  }

  private setupMiddleware(): void {
    // CORS for development
    this.app.use(cors());
    
    // JSON body parser
    this.app.use(express.json());
    
    // Serve static files from public directory
    const publicPath = path.join(__dirname, 'public');
    this.app.use(express.static(publicPath));
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api/tickets', ticketsRouter);
    this.app.use('/api/config', configRouter);
    
    // Health check
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Root route
    this.app.get('/', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  private setupWebSocket(server: http.Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 WebSocket client connected');
      
      ws.on('message', (message: string) => {
        console.log('📩 Received:', message.toString());
      });
      
      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
      });
      
      // Send welcome message
      ws.send(JSON.stringify({ 
        type: 'connected', 
        message: '✓ Connected to AutopilotTS WebSocket' 
      }));
      
      // Send a test log message
      setTimeout(() => {
        this.broadcastLog('✓ Terminal is working! Waiting for backend operations...', 'log');
      }, 500);
    });
  }

  public broadcast(data: any): void {
    if (!this.wss) return;
    
    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public broadcastLog(data: string, type: 'log' | 'error' = 'log', ticketId?: string): void {
    const logMessage: LogMessage = {
      type,
      timestamp: Date.now(),
      data,
      ticketId,
      ansiColor: true
    };
    this.broadcast(logMessage);
  }

  public clearLogs(): void {
    const clearMessage: LogMessage = {
      type: 'clear',
      timestamp: Date.now(),
      data: ''
    };
    this.broadcast(clearMessage);
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer(this.app);
        this.setupWebSocket(this.server);
        
        this.server.listen(this.port, () => {
          console.log(`\n🚀 AutopilotTS Web UI running at http://localhost:${this.port}`);
          console.log(`📡 WebSocket available at ws://localhost:${this.port}/ws\n`);
          resolve();
        });
        
        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${this.port} is already in use`));
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.wss) {
        this.wss.close();
      }
      
      if (this.server) {
        this.server.close((error) => {
          if (error) {
            reject(error);
          } else {
            console.log('Web server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  public getPort(): number {
    return this.port;
  }
}
