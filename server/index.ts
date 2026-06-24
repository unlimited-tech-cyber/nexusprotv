import express from 'express';
import cors from 'cors';
import path from 'path';
import { cdnTokenHandler } from './routes/cdn-token';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS for development (Vite runs on 8080)
app.use(cors({ origin: true }));

// API routes
app.get('/api/cdn-token', cdnTokenHandler);

// In production, serve the built Vite frontend
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`);
});
