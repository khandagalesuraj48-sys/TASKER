// electron/main.cjs
const { app, BrowserWindow, protocol, ipcMain, shell, Notification, Tray, Menu, nativeImage, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

// Define app schema as standard scheme
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;
let tray = null;
let isQuitting = false;

function getIconPath() {
  const icoPath = path.join(__dirname, 'icons', 'icon.ico');
  if (fs.existsSync(icoPath)) return icoPath;
  const pngPath = path.join(__dirname, '../public/favicon.png');
  if (fs.existsSync(pngPath)) return pngPath;
  return path.join(__dirname, '../public/logo.png');
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'TASKER — Enterprise Operations & Task Management',
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Allows cross-origin Supabase / Gemini queries without CORS blocks in desktop
    },
  });

  // Open external links in default OS web browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Hide to tray instead of quitting on close (unless explicitly quitting)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      // Allow standard close on Windows
      return;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load via app:// protocol
  mainWindow.loadURL('app://tasker/index.html');
}

function setupProtocol() {
  const distPath = path.join(__dirname, '../dist');

  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);
      let relativePath = decodeURIComponent(url.pathname);
      if (relativePath === '/' || relativePath === '') {
        relativePath = '/index.html';
      }

      let filePath = path.join(distPath, relativePath);

      // Check if file exists, if not fallback to index.html for SPA client-side routing
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distPath, 'index.html');
      }

      return net.fetch(pathToFileURL(filePath).toString());
    } catch (e) {
      console.error('Protocol handle error:', e);
      const fallbackHtml = path.join(distPath, 'index.html');
      return net.fetch(pathToFileURL(fallbackHtml).toString());
    }
  });
}

function createTray() {
  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open TASKER',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit TASKER',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('TASKER Enterprise Platform');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// IPC Handlers
function setupIpc() {
  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('open-external', async (event, url) => {
    if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle('show-notification', (event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({
        title: title || 'TASKER',
        body: body || '',
        icon: getIconPath(),
      }).show();
      return true;
    }
    return false;
  });

  // Download Windows update (.exe) with streaming progress reporting
  ipcMain.handle('download-update', async (event, downloadUrl) => {
    try {
      const urlObj = new URL(downloadUrl);
      const fileName = path.basename(urlObj.pathname) || 'TASKER-Setup-Update.exe';
      const targetPath = path.join(os.tmpdir(), fileName);

      // Clean up previous temp file if exists
      try {
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
      } catch {}

      const response = await fetch(downloadUrl, {
        headers: {
          'User-Agent': 'TASKER-Desktop-Update-Engine',
          'Accept': '*/*',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`Failed to download update: HTTP ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      let receivedBytes = 0;

      const fileStream = fs.createWriteStream(targetPath);
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.length;
          fileStream.write(Buffer.from(value));
          if (totalBytes > 0) {
            const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
            event.sender.send('update-progress', percent);
          }
        }
      }

      await new Promise((resolve, reject) => {
        fileStream.end(() => resolve());
        fileStream.on('error', reject);
      });

      event.sender.send('update-progress', 100);
      return targetPath;
    } catch (e) {
      console.error('Download update error in Electron main:', e);
      throw e;
    }
  });

  // Install downloaded update and exit
  ipcMain.handle('install-update', async (event, filePath) => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Update installer not found at ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size < 1000) {
      throw new Error('Invalid or corrupted installer file downloaded.');
    }

    if (Notification.isSupported()) {
      new Notification({
        title: 'TASKER Update',
        body: 'Installing latest TASKER update, please wait...',
        icon: getIconPath(),
      }).show();
    }

    // Launch installer detached
    const child = spawn(filePath, [], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    isQuitting = true;
    setTimeout(() => {
      app.quit();
    }, 600);

    return true;
  });
}

// App lifecycle
app.whenReady().then(() => {
  setupProtocol();
  setupIpc();
  createWindow();
  try {
    createTray();
  } catch (e) {
    console.warn('Tray creation warning:', e.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
