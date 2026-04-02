const { app, BrowserWindow } = require('electron');
const path = require('path');
const { startServer } = require('../backend/server');

let mainWindow;
const PORT = 3001;

app.on('ready', async () => {
  // 백엔드 서버 시작
  await startServer(PORT);

  // GUI 창 열기
  mainWindow = new BrowserWindow({
    width: 600,
    height: 750,
    title: '할 일 관리',
    icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
