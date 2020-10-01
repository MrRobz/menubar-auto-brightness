const { menubar } = require('menubar');
const activeWin = require('active-win');
const brightness = require('brightness');
const {
  hasScreenCapturePermission,
  openSystemPreferences
} = require('mac-screen-capture-permissions');
const { ipcMain, systemPreferences } = require('electron');

try {
	require('electron-reloader')(module);
} catch (_) {}


let processToWatchBrightness = {};
let timer;
let hasAccessibilityAccess = false;
let hasScreenPermission = false;

const mb = menubar({
  dir: __dirname,
  browserWindow: {
    height: 400,
    resizable: false,
    width: 320,
    webPreferences: {
      // devTools: true,
      nodeIntegration: true
    }
  },
});


const parseValue = (value, origin = 'range') => ((origin === 'range') ? value / 100 : value * 100);

mb.on('ready', async () => {
  hasScreenPermission = hasScreenCapturePermission();
  if (hasScreenPermission) {
    hasAccessibilityAccess = systemPreferences.isTrustedAccessibilityClient(true);
  }
  
  if (hasAccessibilityAccess && hasScreenPermission) {
    processToWatchBrightness.globalBrightnessValue = await brightness.get();
    timer = setInterval(brightnessMonitor, 1000);
  }

  mb.app.dock.hide();
});

mb.on('after-create-window', () => {
  // mb.window.openDevTools()
})

mb.on('after-hide', () => { mb.app.hide() } )

async function brightnessMonitor() {
    let activeWindow = await activeWin();
    let activeProcessId = activeWindow?.owner?.processId;

    if(processToWatchBrightness[activeProcessId]) {
      brightness.set(processToWatchBrightness[activeProcessId].brightness);
    } else {
      brightness.set(processToWatchBrightness.globalBrightnessValue);
    }
}

ipcMain.on('processSelectedByUser', (event, arg) => {
  processToWatchBrightness[arg.pid] = arg;
  processToWatchBrightness[arg.pid].brightness = 0.7;
});

ipcMain.on('globalBrightnessUpdate', (event, brightnessValue) => {
  processToWatchBrightness.globalBrightnessValue = parseValue(brightnessValue);
})

ipcMain.on('updateProcessBrightness',  (event, pid, brightnessValue) => {
  if (processToWatchBrightness[pid]) {
    processToWatchBrightness[pid].brightness = parseValue(brightnessValue);
  }
})

ipcMain.on('removeWatchOnProcess',  (event, pid) => {
  if (processToWatchBrightness[pid]) {
    delete processToWatchBrightness[pid];
  }
})

ipcMain.on('pauseService', async (event, pause) => {
  if (pause) {
    clearInterval(timer);
  } else {
    hasAccessibilityAccess = systemPreferences.isTrustedAccessibilityClient(true);
    hasScreenPermission = hasScreenCapturePermission();

    let value = parseValue(await brightness.get(), 'percentage');
    event.sender.send('setInitialValue', {
      defaultBrightness: value,
      hasAccessibilityAccess,
      hasScreenPermission
    });
    
    clearInterval(timer);

    if (hasAccessibilityAccess && hasScreenPermission) {
      timer = setInterval(brightnessMonitor, 1000);
    }
  }
})

ipcMain.on('requestInitialValue',  async (event) => {
  const value = parseValue(await brightness.get(), 'percentage');

  event.sender.send('setInitialValue', {
    defaultBrightness: value,
    hasAccessibilityAccess,
    hasScreenPermission
  });
})

ipcMain.on('openSystemPreferences', (event) => {
  hasScreenPermission = hasScreenCapturePermission();
  hasAccessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false);

  openSystemPreferences();
})
