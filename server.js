const http = require('http');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const { port, UPLOADS_ROOT } = require('./config/config');
const authHandler = require('./routes/auth');
const purchaseHandler = require('./routes/purchase');
const invoiceHandler = require('./routes/invoice');
const userHandler = require('./routes/user');
const reimbursementHandler = require('./routes/reimbursement');
const statsHandler = require('./routes/stats');

const PUBLIC_ROOT = path.join(__dirname, 'public');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
};

function serveStatic(res, filePath) {
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server Error');
            }
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', err => {
            reject(err);
        });
    });
}

const server = http.createServer(async(req, res) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const { url, method } = req;
    const parsedUrl = new URL(url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    try {
        // Static file serving
        if (pathname.startsWith('/Uploads/')) {
            const filePath = path.join(UPLOADS_ROOT, pathname.substring('/Uploads/'.length));
            return serveStatic(res, filePath);
        }

        const publicFilePath = path.join(PUBLIC_ROOT, pathname === '/' ? 'index.html' : pathname);
        if (fs.existsSync(publicFilePath) && fs.statSync(publicFilePath).isFile()) {
            return serveStatic(res, publicFilePath);
        }

        // API routes
        if (pathname.startsWith('/api/')) {
            const parts = pathname.substring('/api/'.length).split('/');
            const route = parts[0];
            const subPath = `/${parts.slice(1).join('/')}`;

            req.url = subPath; // Modify req.url to be relative for handlers

            let body = null;
            const contentType = req.headers['content-type'] || '';
            if ((method === 'POST' || method === 'PUT') && !contentType.startsWith('multipart/form-data')) {
                body = await parseJsonBody(req);
            }

            switch (route) {
                case 'auth':
                    return authHandler(req, res, body);
                case 'purchase':
                    return purchaseHandler(req, res, body);
                case 'invoice':
                    return invoiceHandler(req, res, body);
                case 'users':
                    return userHandler(req, res, body);
                case 'reimbursements':
                    return reimbursementHandler(req, res, body);
                case 'stats':
                    return statsHandler(req, res);
                default:
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'API Route Not Found' }));
            }
        } else {
            // Fallback to index.html for SPA-like behavior
            const indexPath = path.join(PUBLIC_ROOT, 'index.html');
            if (fs.existsSync(indexPath)) {
                return serveStatic(res, indexPath);
            }
        }

    } catch (err) {
        console.error('Server Error:', err);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ message: 'Internal Server Error' }));
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`伺服器運行在 http://0.0.0.0:${port}`);
});