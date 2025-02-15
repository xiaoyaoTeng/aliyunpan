import { app, BrowserWindow, dialog, Menu, MessageChannelMain, nativeTheme, Tray } from 'electron'
import { getAsarPath, getResourcesPath, getUserDataPath } from './mainfile'
const { existsSync, readFileSync, writeFileSync } = require('fs')

const DEBUGGING = !app.isPackaged
const DEVTOOL = DEBUGGING || true

export const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36 Edg/102.0.1245.33'
export const Referer = 'https://www.aliyundrive.com/'

export const AppWindow: {
  mainWindow: Electron.BrowserWindow | null
  uploadWindow: Electron.BrowserWindow | null
  downloadWindow: Electron.BrowserWindow | null
  appTray: Electron.Tray | null
  winWidth: number
  winHeight: number
  winTheme: string
} = {
  mainWindow: null,
  uploadWindow: null,
  downloadWindow: null,
  appTray: null,
  winWidth: 0,
  winHeight: 0,
  winTheme: ''
}

export function createMainWindow() {
  Menu.setApplicationMenu(null) 
  
  try {
    const configjson = getUserDataPath('config.json')
    if (existsSync(configjson)) {
      let configdata = JSON.parse(readFileSync(configjson, 'utf-8'))
      AppWindow.winWidth = configdata.width
      AppWindow.winHeight = configdata.height
    }
  } catch {}
  try {
    const themejson = getUserDataPath('theme.json')
    if (existsSync(themejson)) {
      let themedata = JSON.parse(readFileSync(themejson, 'utf-8'))
      AppWindow.winTheme = themedata.theme
    }
  } catch {}
  if (AppWindow.winWidth <= 0) {
    
    try {
      const { screen } = require('electron')
      let size = screen.getPrimaryDisplay().workAreaSize
      let width = size.width * 0.677
      let height = size.height * 0.866
      if (width > AppWindow.winWidth) AppWindow.winWidth = width
      if (size.width >= 970 && width < 970) width = 970 
      if (AppWindow.winWidth > 1080) AppWindow.winWidth = 1080
      if (height > AppWindow.winHeight) AppWindow.winHeight = height
      if (AppWindow.winHeight > 720) AppWindow.winHeight = 720
    } catch {
      AppWindow.winWidth = 970
      AppWindow.winHeight = 600
    }
  }
  AppWindow.mainWindow = creatElectronWindow(AppWindow.winWidth, AppWindow.winHeight, true, 'main', AppWindow.winTheme)

  AppWindow.mainWindow.on('resize', () => {
    debounceResize(function () {
      try {
        if (AppWindow.mainWindow && AppWindow.mainWindow.isMaximized() == false && AppWindow.mainWindow.isMinimized() == false && AppWindow.mainWindow.isFullScreen() == false) {
          let s = AppWindow.mainWindow!.getSize() 
          const configjson = getUserDataPath('config.json')
          writeFileSync(configjson, `{"width":${s[0].toString()},"height": ${s[1].toString()}}`, 'utf-8')
        }
      } catch {}
    }, 3000)
  })

  AppWindow.mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
    } else {
      event.preventDefault()
      AppWindow.mainWindow?.hide()
    }
  })

  AppWindow.mainWindow.on('closed', (event: any) => {
    app.quit()
  })

  AppWindow.mainWindow.on('ready-to-show', function () {
    AppWindow.mainWindow!.webContents.send('setPage', { page: 'PageMain' })
    AppWindow.mainWindow!.webContents.send('setTheme', { dark: nativeTheme.shouldUseDarkColors })
    AppWindow.mainWindow!.setTitle('阿里云盘小白羊版')
    AppWindow.mainWindow!.show()
    creatUploadPort()
    creatDownloadPort()
  })

  AppWindow.mainWindow.webContents.on('render-process-gone', function (event, details) {
    if (details.reason == 'crashed' || details.reason == 'oom' || details.reason == 'killed') {
      ShowErrorAndRelanch('(⊙o⊙)？小白羊遇到错误崩溃了', details.reason)
    }
  })

  creatUpload()
  creatDownload()
}
nativeTheme.on('updated', () => {
  if (AppWindow.mainWindow && !AppWindow.mainWindow.isDestroyed())
    AppWindow.mainWindow.webContents.send('setTheme', {
      dark: nativeTheme.shouldUseDarkColors
    })
})

function ShowErrorAndRelanch(title: string, errmsg: string) {
  dialog
    .showMessageBox({
      type: 'error',
      buttons: ['ok'],
      title: title + '，小白羊将自动退出',
      message: '错误信息:' + errmsg
    })
    .then((_) => {
      setTimeout(() => {
        app.relaunch()
        try {
          app.exit()
        } catch {}
      }, 100)
    })
}
export function ShowErrorAndExit(title: string, errmsg: string) {
  dialog
    .showMessageBox({
      type: 'error',
      buttons: ['ok'],
      title: title + '，小白羊将自动退出',
      message: '错误信息:' + errmsg
    })
    .then((_) => {
      setTimeout(() => {
        try {
          app.exit()
        } catch {}
      }, 100)
    })
}

export function ShowError(title: string, errmsg: string) {
  dialog
    .showMessageBox({
      type: 'error',
      buttons: ['ok'],
      title: title,
      message: '错误信息:' + errmsg
    })
    .then((_) => {})
}

let timerResize: NodeJS.Timeout | undefined = undefined
const debounceResize = (fn: any, wait: number) => {
  if (timerResize) clearTimeout(timerResize)
  timerResize = setTimeout(() => {
    fn()
    timerResize = undefined
  }, wait)
}

export function createTray() {
  
  var trayMenuTemplate = [
    {
      label: '显示主界面',
      click: function () {
        if (AppWindow.mainWindow && AppWindow.mainWindow.isDestroyed() == false) {
          if (AppWindow.mainWindow.isMinimized()) AppWindow.mainWindow.restore()
          AppWindow.mainWindow.show()
          AppWindow.mainWindow.focus()
        } else {
          createMainWindow()
        }
      }
    },
    {
      label: '彻底退出并停止下载',
      click: function () {
        if (AppWindow.mainWindow) {
          AppWindow.mainWindow.destroy()
          AppWindow.mainWindow = null
        }
        app.quit()
      }
    }
  ]

  
  let icon = getResourcesPath('app.ico')
  AppWindow.appTray = new Tray(icon)
  
  const contextMenu = Menu.buildFromTemplate(trayMenuTemplate)
  
  AppWindow.appTray.setToolTip('阿里云盘小白羊版')
  
  AppWindow.appTray.setContextMenu(contextMenu)

  AppWindow.appTray.on('click', () => {
    if (AppWindow.mainWindow && AppWindow.mainWindow.isDestroyed() == false) {
      if (AppWindow.mainWindow.isMinimized()) AppWindow.mainWindow.restore()
      AppWindow.mainWindow.show()
      AppWindow.mainWindow.focus()
    } else {
      createMainWindow()
    }
  })
}

export function creatUpload() {
  if (AppWindow.uploadWindow != null && AppWindow.uploadWindow.isDestroyed() == false) return
  AppWindow.uploadWindow = creatElectronWindow(10, 10, false, 'main', 'dark')

  AppWindow.uploadWindow.on('ready-to-show', function () {
    creatUploadPort()
    AppWindow.uploadWindow!.webContents.send('setPage', { page: 'PageWorker', data: { type: 'upload' } })
    AppWindow.uploadWindow!.setTitle('阿里云盘小白羊版上传进程')
  })

  AppWindow.uploadWindow.webContents.on('render-process-gone', function (event, details) {
    if (details.reason == 'crashed' || details.reason == 'oom' || details.reason == 'killed' || details.reason == 'integrity-failure') {
      try {
        AppWindow.uploadWindow?.destroy()
      } catch {}
      AppWindow.uploadWindow = null
      creatUpload()
    }
  })
}

export function creatDownload() {
  if (AppWindow.downloadWindow != null && AppWindow.downloadWindow.isDestroyed() == false) return
  AppWindow.downloadWindow = creatElectronWindow(10, 10, false, 'main', 'dark')

  AppWindow.downloadWindow.on('ready-to-show', function () {
    creatDownloadPort()
    AppWindow.downloadWindow!.webContents.send('setPage', { page: 'PageWorker', data: { type: 'download' } })
    AppWindow.downloadWindow!.setTitle('阿里云盘小白羊版下载进程')
  })

  AppWindow.downloadWindow.webContents.on('render-process-gone', function (event, details) {
    if (details.reason == 'crashed' || details.reason == 'oom' || details.reason == 'killed' || details.reason == 'integrity-failure') {
      try {
        AppWindow.downloadWindow?.destroy()
      } catch {}
      AppWindow.downloadWindow = null
      creatDownload()
    }
  })
}

export function creatElectronWindow(width: number, height: number, center: boolean, page: string, theme: string) {
  let win = new BrowserWindow({
    show: false,
    width: width,
    height: height,
    minWidth: width > 680 ? 680 : width,
    minHeight: height > 500 ? 500 : height,
    center: center,
    icon: getResourcesPath('app.ico'),
    useContentSize: true,
    frame: false,
    hasShadow: width > 680,
    autoHideMenuBar: true,
    backgroundColor: theme && theme == 'dark' ? '#23232e' : '#ffffff',
    webPreferences: {
      spellcheck: false,
      devTools: DEVTOOL,
      webviewTag: true,
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      contextIsolation: false,
      backgroundThrottling: false,
      enableWebSQL: true,
      disableBlinkFeatures: 'OutOfBlinkCors,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
      preload: getAsarPath('dist/preload/index.js')
    }
  })
  win.removeMenu()
  if (DEBUGGING) {
    const url = `http://localhost:${process.env['VITE_DEV_SERVER_PORT']}`
    win.loadURL(url, { userAgent: ua, httpReferrer: Referer })
  } else {
    win.loadURL('file://' + getAsarPath('dist/' + page + '.html'), {
      userAgent: ua,
      httpReferrer: Referer
    })
  }

  if (DEVTOOL) {
    if (width < 100) win.setSize(800, 600)
    win.show()
    win.webContents.openDevTools()
  } else {
    win.webContents.on('devtools-opened', () => {
      if (win) win.webContents.closeDevTools()
    })
  }

  win.webContents.on('did-create-window', (childWindow) => {
    if (process.platform === 'win32') {
      childWindow.setMenu(null) 
    }
  })
  return win
}

function creatUploadPort() {
  debounceUpload(function () {
    if (AppWindow.mainWindow && AppWindow.uploadWindow && AppWindow.uploadWindow.isDestroyed() == false) {
      const { port1, port2 } = new MessageChannelMain()
      AppWindow.mainWindow.webContents.postMessage('setUploadPort', null, [port1])
      AppWindow.uploadWindow.webContents.postMessage('setPort', null, [port2])
    }
  }, 1000)
}
function creatDownloadPort() {
  debounceDownload(function () {
    if (AppWindow.mainWindow && AppWindow.downloadWindow && AppWindow.downloadWindow.isDestroyed() == false) {
      const { port1, port2 } = new MessageChannelMain()
      AppWindow.mainWindow.webContents.postMessage('setDownloadPort', null, [port1])
      AppWindow.downloadWindow.webContents.postMessage('setPort', null, [port2])
    }
  }, 1000)
}
let timerUpload: NodeJS.Timeout | undefined = undefined
const debounceUpload = (fn: any, wait: number) => {
  if (timerUpload) {
    clearTimeout(timerUpload)
  }
  timerUpload = setTimeout(() => {
    fn()
    timerUpload = undefined
  }, wait)
}
let timerDownload: NodeJS.Timeout | undefined = undefined
const debounceDownload = (fn: any, wait: number) => {
  if (timerDownload) {
    clearTimeout(timerDownload)
  }
  timerDownload = setTimeout(() => {
    fn()
    timerDownload = undefined
  }, wait)
}
