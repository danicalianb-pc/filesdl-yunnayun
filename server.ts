import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

interface StoredFileMeta {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  senderNote?: string;
  createdAt: number;
  expiresAt: number | null; // null = permanent
  downloadLimit: number; // 0 = unlimited
  downloadCount: number;
  deleteToken: string;
}

const PORT = 3000;
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const DB_FILE = path.join(UPLOAD_DIR, 'metadata_db.json');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// In-memory cache synced with disk
let fileRegistry: Map<string, StoredFileMeta> = new Map();

function loadRegistry() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed: Record<string, StoredFileMeta> = JSON.parse(data);
      fileRegistry = new Map(Object.entries(parsed));
    }
  } catch (err) {
    console.error('Error loading metadata database:', err);
  }
}

function saveRegistry() {
  try {
    const obj = Object.fromEntries(fileRegistry.entries());
    fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving metadata database:', err);
  }
}

function deleteFileById(id: string) {
  const meta = fileRegistry.get(id);
  if (!meta) return false;

  const filePath = path.join(UPLOAD_DIR, `${id}.bin`);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error(`Failed to delete binary for file ${id}:`, e);
    }
  }
  fileRegistry.delete(id);
  saveRegistry();
  return true;
}

// Background cleanup routine for expired or burned files
function cleanupExpiredFiles() {
  const now = Date.now();
  let modified = false;

  for (const [id, meta] of fileRegistry.entries()) {
    const isTimeExpired = meta.expiresAt !== null && now > meta.expiresAt;
    const isLimitReached = meta.downloadLimit > 0 && meta.downloadCount >= meta.downloadLimit;

    if (isTimeExpired || isLimitReached) {
      const filePath = path.join(UPLOAD_DIR, `${id}.bin`);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error(`Cleanup error on ${id}:`, e);
        }
      }
      fileRegistry.delete(id);
      modified = true;
    }
  }

  if (modified) {
    saveRegistry();
  }
}

// Run cleanup every 60 seconds
setInterval(cleanupExpiredFiles, 60 * 1000);

async function startServer() {
  loadRegistry();
  cleanupExpiredFiles();

  const app = express();

  // Support up to 250MB payload
  app.use(express.json({ limit: '250mb' }));
  app.use(express.urlencoded({ extended: true, limit: '250mb' }));

  // API Routes

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: "'Yun na 'yun? File Sharing" });
  });

  // Global platform statistics
  app.get('/api/stats', (req, res) => {
    cleanupExpiredFiles();
    let totalStorageBytes = 0;
    for (const meta of fileRegistry.values()) {
      totalStorageBytes += meta.size || 0;
    }
    res.json({
      activeTransfers: fileRegistry.size,
      totalStorageBytes,
      serverTime: Date.now(),
    });
  });

  // Direct Upload endpoint
  app.post('/api/files/upload', (req, res) => {
    try {
      const {
        id,
        originalName,
        mimeType,
        size,
        fileBase64,
        senderNote,
        expiresAt,
        downloadLimit,
        deleteToken,
      } = req.body;

      if (!id || !originalName || !fileBase64 || !deleteToken) {
        return res.status(400).json({ error: 'Missing required file fields' });
      }

      // Convert base64 data to buffer and write to disk
      const buffer = Buffer.from(fileBase64, 'base64');
      const filePath = path.join(UPLOAD_DIR, `${id}.bin`);
      fs.writeFileSync(filePath, buffer);

      const meta: StoredFileMeta = {
        id,
        originalName: String(originalName).slice(0, 255),
        mimeType: String(mimeType || 'application/octet-stream'),
        size: Number(size) || buffer.length,
        senderNote: senderNote ? String(senderNote).slice(0, 1000) : undefined,
        createdAt: Date.now(),
        expiresAt: expiresAt === null || expiresAt === undefined ? null : Number(expiresAt),
        downloadLimit: Number(downloadLimit) || 0,
        downloadCount: 0,
        deleteToken: String(deleteToken),
      };

      fileRegistry.set(id, meta);
      saveRegistry();

      return res.json({
        success: true,
        fileId: id,
        originalName: meta.originalName,
        size: meta.size,
        expiresAt: meta.expiresAt,
        downloadLimit: meta.downloadLimit,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: err.message || 'Internal server upload error' });
    }
  });

  // Metadata endpoint for recipient
  app.get('/api/files/:id/meta', (req, res) => {
    const { id } = req.params;
    cleanupExpiredFiles();

    const meta = fileRegistry.get(id);
    if (!meta) {
      return res.status(404).json({
        error: 'Transfer not found or has already expired / been deleted.',
      });
    }

    const now = Date.now();
    if (meta.expiresAt !== null && now > meta.expiresAt) {
      deleteFileById(id);
      return res.status(410).json({
        error: 'This file transfer link has expired and was automatically deleted.',
      });
    }

    if (meta.downloadLimit > 0 && meta.downloadCount >= meta.downloadLimit) {
      deleteFileById(id);
      return res.status(410).json({
        error: 'This link has reached its maximum download limit and was deleted.',
      });
    }

    // Expose metadata
    res.json({
      id: meta.id,
      originalName: meta.originalName,
      mimeType: meta.mimeType,
      size: meta.size,
      senderNote: meta.senderNote,
      createdAt: meta.createdAt,
      expiresAt: meta.expiresAt,
      downloadLimit: meta.downloadLimit,
      downloadCount: meta.downloadCount,
    });
  });

  // Direct binary download endpoint (Instant 1-click download)
  app.get('/api/files/:id/download', (req, res) => {
    const { id } = req.params;
    cleanupExpiredFiles();

    const meta = fileRegistry.get(id);
    if (!meta) {
      return res.status(404).json({
        error: 'File not found or has already expired.',
      });
    }

    const filePath = path.join(UPLOAD_DIR, `${id}.bin`);
    if (!fs.existsSync(filePath)) {
      fileRegistry.delete(id);
      saveRegistry();
      return res.status(404).json({ error: 'File binary does not exist on storage.' });
    }

    // Direct native browser download headers
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', meta.size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(meta.originalName)}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      // Increment download counter
      meta.downloadCount += 1;
      saveRegistry();

      // If download limit reached, clean up file
      if (meta.downloadLimit > 0 && meta.downloadCount >= meta.downloadLimit) {
        setTimeout(() => {
          deleteFileById(id);
        }, 1000);
      }
    });

    fileStream.on('error', (err) => {
      console.error(`Stream error during download of ${id}:`, err);
    });
  });

  // Inline view/preview endpoint
  app.get('/api/files/:id/raw', (req, res) => {
    const { id } = req.params;
    cleanupExpiredFiles();

    const meta = fileRegistry.get(id);
    if (!meta) {
      return res.status(404).send('File not found');
    }

    const filePath = path.join(UPLOAD_DIR, `${id}.bin`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File missing');
    }

    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', meta.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.originalName)}"`);

    fs.createReadStream(filePath).pipe(res);
  });

  // Sender file deletion endpoint
  app.post('/api/files/:id/delete', (req, res) => {
    const { id } = req.params;
    const token = req.body?.deleteToken || req.headers['x-delete-token'] || req.query?.deleteToken;

    const meta = fileRegistry.get(id);
    if (!meta) {
      return res.status(404).json({ error: 'File already does not exist or was deleted.' });
    }

    if (meta.deleteToken !== token) {
      return res.status(403).json({ error: 'Invalid deletion authorization key.' });
    }

    deleteFileById(id);
    return res.json({ success: true, message: 'File successfully deleted immediately.' });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`'Yun na 'yun? File Sharing server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
