declare global {
  interface Window {
    electronAPI: {
      toggleWindow: () => Promise<void>;
      takeScreenshot: () => Promise<{ path: string; preview: string }>;
      resetQueues: () => Promise<void>;
      startRecording: () => Promise<void>;
      stopRecording: () => Promise<void>;
      quitApp: () => Promise<void>;
    };
  };
}