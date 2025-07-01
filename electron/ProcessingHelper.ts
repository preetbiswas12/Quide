// ProcessingHelper.ts

import { AppState } from "./main";
import { LLMHelper } from "./LLMHelper";
import dotenv from "dotenv";

dotenv.config();

const isDev = process.env.NODE_ENV === "development";
const isDevTest = process.env.IS_DEV_TEST === "true";
const MOCK_API_WAIT_TIME = Number(process.env.MOCK_API_WAIT_TIME) || 500;

export class ProcessingHelper {
  private appState: AppState;
  private llmHelper: LLMHelper;
  private currentProcessingAbortController: AbortController | null = null;
  private currentExtraProcessingAbortController: AbortController | null = null;

  constructor(appState: AppState) {
    this.appState = appState;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not found in environment variables");
    }
    this.llmHelper = new LLMHelper(apiKey);
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.appState.getMainWindow();
    if (!mainWindow) return;

    const view = this.appState.getView();

    if (view === "queue") {
      const screenshotQueue = this.appState.getScreenshotHelper().getScreenshotQueue();
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS);
        return;
      }

      const allPaths = screenshotQueue;
      const lastPath = allPaths[allPaths.length - 1];

      // Audio fallback
      if (lastPath.endsWith(".mp3") || lastPath.endsWith(".wav")) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START);
        this.appState.setView("solutions");
      }

      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START);
      this.appState.setView("solutions");

      this.currentProcessingAbortController = new AbortController();
      try {
        const result = await this.llmHelper.analyzeImageFile(lastPath);
        const raw = result.raw || "// ⚠️ No content returned from Gemini";

        const problemInfo = {
          problem_statement: raw,
          input_format: { description: "Generated from screenshot", parameters: [] },
          output_format: {
            description: "Generated from screenshot",
            type: "string",
            subtype: "text",
          },
          complexity: { time: "N/A", space: "N/A" },
          test_cases: [],
          validation_type: "manual",
          difficulty: "custom",
        };

        this.appState.setProblemInfo(problemInfo);
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
          problemInfo
        );
      } catch (error: any) {
        console.error("Image processing error:", error);
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error.message
        );
      } finally {
        this.currentProcessingAbortController = null;
      }

      return;
    }

    // Debug mode
    const extraQueue = this.appState.getScreenshotHelper().getExtraScreenshotQueue();
    if (extraQueue.length === 0) {
      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS);
      return;
    }

    mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_START);
    this.currentExtraProcessingAbortController = new AbortController();

    try {
      const problemInfo = this.appState.getProblemInfo();
      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      const solution = await this.llmHelper.generateSolution(problemInfo);
      const currentCode = solution.solution.code || "// ⚠️ No code generated";

      const debugResult = await this.llmHelper.debugSolutionWithImages(
        problemInfo,
        currentCode,
        extraQueue
      );

      this.appState.setHasDebugged(true);
      mainWindow.webContents.send(
        this.appState.PROCESSING_EVENTS.DEBUG_SUCCESS,
        debugResult
      );
    } catch (error: any) {
      console.error("Debug processing error:", error);
      mainWindow.webContents.send(
        this.appState.PROCESSING_EVENTS.DEBUG_ERROR,
        error.message
      );
    } finally {
      this.currentExtraProcessingAbortController = null;
    }
  }

  public cancelOngoingRequests(): void {
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
    }

    this.appState.setHasDebugged(false);
  }

  public async processAudioBase64(data: string, mimeType: string) {
    return this.llmHelper.analyzeAudioFromBase64(data, mimeType);
  }

  public async processAudioFile(filePath: string) {
    return this.llmHelper.analyzeAudioFile(filePath);
  }

  public getLLMHelper() {
    return this.llmHelper;
  }
}
