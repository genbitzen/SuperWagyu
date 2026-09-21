import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { MockLazadaProvider } from './providers/mockProvider.js';
import { RealLazadaProvider } from './providers/realLazadaProvider.js';
import { InMemoryDatabaseRepository, SupabaseDatabaseRepository, IDatabaseRepository } from './repository/db.js';
import { MonitoringWorker } from './services/monitoringWorker.js';
import { InMemorySessionStore } from './services/sessionStore.js';
import { MockAutoReservationService } from './services/reservationService.js';

// Resolve .env from monorepo root: apps/backend/src/ -> apps/backend/ -> apps/ -> root (3 levels)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '..', '..', '.env');
dotenv.config({ path: envPath });

const useMock = process.env.USE_MOCK_PROVIDER !== 'false';
const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || '3000', 10);
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Provider setup
const mockProvider = new MockLazadaProvider(false);
const provider = useMock ? mockProvider : new RealLazadaProvider();

// DB Repository & Session Store setup
const db: IDatabaseRepository = (supabaseUrl.includes('mock.supabase.co') || !supabaseUrl)
  ? new InMemoryDatabaseRepository()
  : new SupabaseDatabaseRepository(supabaseUrl, supabaseKey);

const sessionStore = new InMemorySessionStore();
const reservationService = new MockAutoReservationService(false);

// Seed sample product for local testing if empty
async function seedInitialData() {
  const products = await db.getMonitoredProducts();
  if (products.length === 0) {
    const sampleProduct = await db.addProduct('https://www.lazada.sg/products/pokmon-center-original-plush-deck-case-pikachu-i13822368851.html', 'sample-prod-001');
    mockProvider.setProductAvailability(sampleProduct.url, false, 'OUT_OF_STOCK');
    console.log(`[Seed] Seeded sample product: ${sampleProduct.url} (ID: ${sampleProduct.id})`);
  }
}

const worker = new MonitoringWorker({
  provider,
  db,
  reservationService,
  pollIntervalMs
});

// Create simple HTTP management endpoint for Mobile App / Dev testing
const PORT = process.env.PORT || 3001;

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlParts = req.url?.split('?') || ['/'];
  const path = urlParts[0];

  try {
    if (req.method === 'GET' && path === '/api/products') {
      const products = await db.getMonitoredProducts();
      res.writeHead(200);
      res.end(JSON.stringify(products));
      return;
    }

    if (req.method === 'GET' && path === '/api/session/status') {
      const status = await sessionStore.getSessionStatus();
      res.writeHead(200);
      res.end(JSON.stringify(status));
      return;
    }

    if (req.method === 'POST' && path === '/api/session/login') {
      const status = await sessionStore.saveSession({ cookies: { 'lzd_session': 'active_token' } });
      res.writeHead(200);
      res.end(JSON.stringify(status));
      return;
    }

    if (req.method === 'GET' && path === '/api/events') {
      const events = await db.getAvailabilityEvents();
      res.writeHead(200);
      res.end(JSON.stringify(events));
      return;
    }

    if (req.method === 'POST' && path === '/api/products') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        const data = JSON.parse(body || '{}');
        if (!data.url) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'url is required' }));
          return;
        }
        const product = await db.addProduct(data.url, data.productId);
        if (useMock) {
          mockProvider.setProductAvailability(product.url, false, 'OUT_OF_STOCK');
        }
        res.writeHead(201);
        res.end(JSON.stringify(product));
      });
      return;
    }

    if (req.method === 'POST' && path === '/api/products/toggle-status') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        const data = JSON.parse(body || '{}');
        const product = await db.getProductById(data.id);
        if (!product) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Product not found' }));
          return;
        }
        const nextStatus = product.status === 'MONITORING' ? 'STOPPED' : 'MONITORING';
        await db.updateProductState(product.id, product.last_availability, nextStatus);
        res.writeHead(200);
        res.end(JSON.stringify({ id: product.id, status: nextStatus }));
      });
      return;
    }

    if (req.method === 'POST' && path === '/api/mock/restock') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        const data = JSON.parse(body || '{}');
        const products = await db.getMonitoredProducts();
        const target = products.find((p) => p.id === data.id || p.url === data.url) || products[0];

        if (!target) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'No product available to restock' }));
          return;
        }

        const isNowAvailable = mockProvider.toggleAvailability(target.url);
        res.writeHead(200);
        res.end(JSON.stringify({
          message: `Toggled restock state for ${target.url}`,
          url: target.url,
          isNowAvailable
        }));
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Route not found' }));
  } catch (err: any) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err?.message || 'Server error' }));
  }
});

seedInitialData().then(() => {
  worker.start();
  server.listen(PORT, () => {
    console.log(`[Backend Server] API listening on http://localhost:${PORT}`);
  });
});
