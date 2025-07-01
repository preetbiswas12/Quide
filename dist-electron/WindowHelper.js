"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowHelper = void 0;
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const logPath = node_path_1.default.join(electron_1.app.getPath("userData"), "app.log");
const logStream = node_fs_1.default.createWriteStream(logPath, { flags: "a" });
function log(message) {
    const formatted = `[${new Date().toISOString()}] ${message}\n`;
    console.log(formatted);
    logStream.write(formatted);
}
const fallbackPath = node_path_1.default.resolve(__dirname, "..", "dist", "index.html");
const startUrl = `file://${fallbackPath}`;
class WindowHelper {
    mainWindow = null;
    isWindowVisible = false;
    windowPosition = null;
    windowSize = null;
    appState;
    screenWidth = 0;
    screenHeight = 0;
    step = 0;
    currentX = 0;
    currentY = 0;
    constructor(appState) {
        this.appState = appState;
    }
    setWindowDimensions(width, height) {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
            return;
        const [currentX, currentY] = this.mainWindow.getPosition();
        const { width: screenW } = electron_1.screen.getPrimaryDisplay().workAreaSize;
        const maxAllowedWidth = Math.floor(screenW * (this.appState.getHasDebugged() ? 0.75 : 0.5));
        const newWidth = Math.min(width + 32, maxAllowedWidth);
        const newHeight = Math.ceil(height);
        const maxX = screenW - newWidth;
        const newX = Math.min(Math.max(currentX, 0), maxX);
        try {
            this.mainWindow.setBounds({ x: newX, y: currentY, width: newWidth, height: newHeight });
        }
        catch (err) {
            log("❌ Failed to set bounds: " + err.message);
        }
        this.windowPosition = { x: newX, y: currentY };
        this.windowSize = { width: newWidth, height: newHeight };
        this.currentX = newX;
    }
    createWindow() {
        if (this.mainWindow)
            return;
        const { width, height } = electron_1.screen.getPrimaryDisplay().workAreaSize;
        this.screenWidth = width;
        this.screenHeight = height;
        this.step = Math.floor(width / 10);
        this.currentX = 0;
        const windowSettings = {
            height: 600,
            x: this.currentX,
            y: 0,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: true,
                preload: node_path_1.default.join(__dirname, "preload.js")
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
        };
        this.mainWindow = new electron_1.BrowserWindow(windowSettings);
        this.mainWindow.setContentProtection(true);
        // 🖱️ Make window click-through and pass clicks to below
        this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
        if (process.platform === "darwin") {
            this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            this.mainWindow.setHiddenInMissionControl(true);
            this.mainWindow.setAlwaysOnTop(true, "floating");
        }
        if (process.platform === "linux") {
            if (this.mainWindow.setHasShadow)
                this.mainWindow.setHasShadow(false);
            this.mainWindow.setFocusable(false); // Linux-specific fallback
        }
        this.mainWindow.setSkipTaskbar(true);
        this.mainWindow.setAlwaysOnTop(true);
        if (!node_fs_1.default.existsSync(fallbackPath)) {
            log("❌ index.html not found at: " + fallbackPath);
            return;
        }
        this.mainWindow.loadURL(startUrl)
            .then(() => log("✅ Loaded index.html from: " + startUrl))
            .catch(err => log("❌ Failed to load index.html: " + err.message));
        this.mainWindow.once("ready-to-show", () => this.mainWindow?.showInactive());
        const bounds = this.mainWindow.getBounds();
        this.windowPosition = { x: bounds.x, y: bounds.y };
        this.windowSize = { width: bounds.width, height: bounds.height };
        this.currentX = bounds.x;
        this.currentY = bounds.y;
        this.setupWindowListeners();
        this.isWindowVisible = true;
    }
    setupWindowListeners() {
        if (!this.mainWindow)
            return;
        this.mainWindow.on("move", () => {
            const bounds = this.mainWindow.getBounds();
            this.windowPosition = { x: bounds.x, y: bounds.y };
            this.currentX = bounds.x;
            this.currentY = bounds.y;
        });
        this.mainWindow.on("resize", () => {
            const bounds = this.mainWindow.getBounds();
            this.windowSize = { width: bounds.width, height: bounds.height };
        });
        this.mainWindow.on("closed", () => {
            this.mainWindow = null;
            this.isWindowVisible = false;
            this.windowPosition = null;
            this.windowSize = null;
        });
    }
    getMainWindow() {
        return this.mainWindow;
    }
    isVisible() {
        return this.isWindowVisible;
    }
    hideMainWindow() {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
            return;
        const bounds = this.mainWindow.getBounds();
        this.windowPosition = { x: bounds.x, y: bounds.y };
        this.windowSize = { width: bounds.width, height: bounds.height };
        this.mainWindow.hide();
        this.isWindowVisible = false;
    }
    showMainWindow() {
        if (!this.mainWindow || this.mainWindow.isDestroyed())
            return;
        if (this.windowPosition && this.windowSize) {
            this.mainWindow.setBounds({
                x: this.windowPosition.x,
                y: this.windowPosition.y,
                width: this.windowSize.width,
                height: this.windowSize.height
            });
        }
        this.mainWindow.showInactive();
        this.isWindowVisible = true;
    }
    toggleMainWindow() {
        this.isWindowVisible ? this.hideMainWindow() : this.showMainWindow();
    }
    // New methods for window movement
    moveWindowRight() {
        if (!this.mainWindow)
            return;
        const windowWidth = this.windowSize?.width || 0;
        const halfWidth = windowWidth / 2;
        // Ensure currentX and currentY are numbers
        this.currentX = Number(this.currentX) || 0;
        this.currentY = Number(this.currentY) || 0;
        this.currentX = Math.min(this.screenWidth - halfWidth, this.currentX + this.step);
        this.mainWindow.setPosition(Math.round(this.currentX), Math.round(this.currentY));
    }
    moveWindowLeft() {
        if (!this.mainWindow)
            return;
        const windowWidth = this.windowSize?.width || 0;
        const halfWidth = windowWidth / 2;
        // Ensure currentX and currentY are numbers
        this.currentX = Number(this.currentX) || 0;
        this.currentY = Number(this.currentY) || 0;
        this.currentX = Math.max(-halfWidth, this.currentX - this.step);
        this.mainWindow.setPosition(Math.round(this.currentX), Math.round(this.currentY));
    }
    moveWindowDown() {
        if (!this.mainWindow)
            return;
        const windowHeight = this.windowSize?.height || 0;
        const halfHeight = windowHeight / 2;
        // Ensure currentX and currentY are numbers
        this.currentX = Number(this.currentX) || 0;
        this.currentY = Number(this.currentY) || 0;
        this.currentY = Math.min(this.screenHeight - halfHeight, this.currentY + this.step);
        this.mainWindow.setPosition(Math.round(this.currentX), Math.round(this.currentY));
    }
    moveWindowUp() {
        if (!this.mainWindow)
            return;
        const windowHeight = this.windowSize?.height || 0;
        const halfHeight = windowHeight / 2;
        // Ensure currentX and currentY are numbers
        this.currentX = Number(this.currentX) || 0;
        this.currentY = Number(this.currentY) || 0;
        this.currentY = Math.max(-halfHeight, this.currentY - this.step);
        this.mainWindow.setPosition(Math.round(this.currentX), Math.round(this.currentY));
    }
    setClickThrough(enabled) {
        if (!this.mainWindow)
            return;
        this.mainWindow.setIgnoreMouseEvents(enabled, { forward: enabled });
    }
}
exports.WindowHelper = WindowHelper;
//# sourceMappingURL=WindowHelper.js.map