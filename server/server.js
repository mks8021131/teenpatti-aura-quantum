const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = 4000;

// Middleware to inject live-reload script into HTML files
app.use((req, res, next) => {
    if (req.url === '/' || req.url.endsWith('.html')) {
        const filePath = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url);
        
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            const liveReloadScript = `
                <script>
                    (function() {
                        const ws = new WebSocket('ws://' + window.location.host);
                        ws.onmessage = (event) => {
                            if (event.data === 'reload') {
                                console.log('File changed. Reloading...');
                                window.location.reload();
                            }
                        };
                        console.log('Live Reload enabled.');
                    })();
                </script>
            `;
            content = content.replace('</body>', `${liveReloadScript}</body>`);
            return res.send(content);
        }
    }
    next();
});

// Serve root files (premium website) at the root URL
app.use(express.static(path.join(__dirname, '..')));

// Serve public folder (APK and simple download page) at /dist
app.use('/dist', express.static(path.join(__dirname, 'public')));

// Also serve APK at root for direct links like 'app-release.apk'
app.get('/app-release.apk', (req, res) => {
    const apkPath = path.join(__dirname, 'public', 'app-release.apk');
    if (fs.existsSync(apkPath)) {
        res.download(apkPath);
    } else {
        res.status(404).send('APK file not found. Please run the build script first.');
    }
});

// Watch for changes in the project root
const watcher = chokidar.watch(path.join(__dirname, '..'), {
    ignored: [/node_modules/, /\.git/, /server/, /teenpatti_app/],
    persistent: true
});

watcher.on('change', (filePath) => {
    console.log(`[WATCHER] File changed: ${path.relative(path.join(__dirname, '..'), filePath)}`);
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
            client.send('reload');
        }
    });
});

// Detect Local IP
const networkInterfaces = os.networkInterfaces();
let localIp = 'localhost';
for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            localIp = iface.address;
            break;
        }
    }
}

server.listen(port, '0.0.0.0', () => {
    console.log('\n=========================================');
    console.log('🚀 LIVE AUTO-REFRESH DASHBOARD ACTIVE');
    console.log(`Local Access: http://localhost:${port}`);
    console.log(`Network/Mobile Access: http://${localIp}:${port}`);
    console.log('=========================================');
});
