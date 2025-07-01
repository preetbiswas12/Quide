import { BrowserWindow, screen, app } from "electron"
import { AppState } from "main"
import path from "node:path"
import fs from "node:fs"

const logPath = path.join(app.getPath("userData"), "app.log")
const logStream = fs.createWriteStream(logPath, { flags: "a" })
function log(message: string) {
  const formatted = `[${new Date().toISOString()}] ${message}\n`
  console.log(formatted)
  logStream.write(formatted)
}

const fallbackPath = path.resolve(__dirname, "..", "dist", "index.html")
const startUrl = `file://${fallbackPath}`

export class WindowHelper {
  private mainWindow: BrowserWindow | null = null
  private isWindowVisible = false
  private windowPosition: { x: number; y: number } | null = null
  private windowSize: { width: number; height: number } | null = null
  private appState: AppState

  private screenWidth = 0
  private screenHeight = 0
  private step = 0
  private currentX = 0
  private currentY = 0

  constructor(appState: AppState) {
    this.appState = appState
  }

  public setWindowDimensions(width: number, height: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    const [currentX, currentY] = this.mainWindow.getPosition()
    const { width: screenW } = screen.getPrimaryDisplay().workAreaSize

    const maxAllowedWidth = Math.floor(
      screenW * (this.appState.getHasDebugged() ? 0.75 : 0.5)
    )
    const newWidth = Math.min(width + 32, maxAllowedWidth)
    const newHeight = Math.ceil(height)
    const maxX = screenW - newWidth
    const newX = Math.min(Math.max(currentX, 0), maxX)

    try {
      this.mainWindow.setBounds({ x: newX, y: currentY, width: newWidth, height: newHeight })
    } catch (err) {
      log("❌ Failed to set bounds: " + (err as Error).message)
    }

    this.windowPosition = { x: newX, y: currentY }
    this.windowSize = { width: newWidth, height: newHeight }
    this.currentX = newX
  }

  public createWindow(): void {
    if (this.mainWindow) return

    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    this.screenWidth = width
    this.screenHeight = height
    this.step = Math.floor(width / 10)
    this.currentX = 0

    const windowSettings: Electron.BrowserWindowConstructorOptions = {
      height: 600,
      x: this.currentX,
      y: 0,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js")
      },
      show: false,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      fullscreenable: false,
      hasShadow: false,
      backgroundColor: "#00000000",
      focusable: false, // 👈 Key for unfocusable window
      skipTaskbar: true
    }

    this.mainWindow = new BrowserWindow(windowSettings)
    this.mainWindow.setContentProtection(true)

    // 🖱️ Make window click-through and pass clicks to below
    this.mainWindow.setIgnoreMouseEvents(true, { forward: true })

    if (process.platform === "darwin") {
      this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      this.mainWindow.setHiddenInMissionControl(true)
      this.mainWindow.setAlwaysOnTop(true, "floating")
    }

    if (process.platform === "linux") {
      if (this.mainWindow.setHasShadow) this.mainWindow.setHasShadow(false)
      this.mainWindow.setFocusable(false) // Linux-specific fallback
    }

    this.mainWindow.setSkipTaskbar(true)
    this.mainWindow.setAlwaysOnTop(true)

    if (!fs.existsSync(fallbackPath)) {
      log("❌ index.html not found at: " + fallbackPath)
      return
    }

    this.mainWindow.loadURL(startUrl)
      .then(() => log("✅ Loaded index.html from: " + startUrl))
      .catch(err => log("❌ Failed to load index.html: " + err.message))

    this.mainWindow.once("ready-to-show", () => this.mainWindow?.showInactive())

    const bounds = this.mainWindow.getBounds()
    this.windowPosition = { x: bounds.x, y: bounds.y }
    this.windowSize = { width: bounds.width, height: bounds.height }
    this.currentX = bounds.x
    this.currentY = bounds.y

    this.setupWindowListeners()
    this.isWindowVisible = true
  }

  private setupWindowListeners(): void {
    if (!this.mainWindow) return

    this.mainWindow.on("move", () => {
      const bounds = this.mainWindow!.getBounds()
      this.windowPosition = { x: bounds.x, y: bounds.y }
      this.currentX = bounds.x
      this.currentY = bounds.y
    })

    this.mainWindow.on("resize", () => {
      const bounds = this.mainWindow!.getBounds()
      this.windowSize = { width: bounds.width, height: bounds.height }
    })

    this.mainWindow.on("closed", () => {
      this.mainWindow = null
      this.isWindowVisible = false
      this.windowPosition = null
      this.windowSize = null
    })
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  public isVisible(): boolean {
    return this.isWindowVisible
  }

  public hideMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    const bounds = this.mainWindow.getBounds()
    this.windowPosition = { x: bounds.x, y: bounds.y }
    this.windowSize = { width: bounds.width, height: bounds.height }
    this.mainWindow.hide()
    this.isWindowVisible = false
  }

  public showMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    if (this.windowPosition && this.windowSize) {
      this.mainWindow.setBounds({
        x: this.windowPosition.x,
        y: this.windowPosition.y,
        width: this.windowSize.width,
        height: this.windowSize.height
      })
    }

    this.mainWindow.showInactive()
    this.isWindowVisible = true
  }

  public toggleMainWindow(): void {
    this.isWindowVisible ? this.hideMainWindow() : this.showMainWindow()
  }

    // New methods for window movement
  public moveWindowRight(): void {
    if (!this.mainWindow) return

    const windowWidth = this.windowSize?.width || 0
    const halfWidth = windowWidth / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentX = Math.min(
      this.screenWidth - halfWidth,
      this.currentX + this.step
    )
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowLeft(): void {
    if (!this.mainWindow) return

    const windowWidth = this.windowSize?.width || 0
    const halfWidth = windowWidth / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentX = Math.max(-halfWidth, this.currentX - this.step)
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowDown(): void {
    if (!this.mainWindow) return

    const windowHeight = this.windowSize?.height || 0
    const halfHeight = windowHeight / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentY = Math.min(
      this.screenHeight - halfHeight,
      this.currentY + this.step
    )
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowUp(): void {
    if (!this.mainWindow) return

    const windowHeight = this.windowSize?.height || 0
    const halfHeight = windowHeight / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentY = Math.max(-halfHeight, this.currentY - this.step)
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public setClickThrough(enabled: boolean): void {
    if (!this.mainWindow) return
    this.mainWindow.setIgnoreMouseEvents(enabled, { forward: enabled })
  }
}
