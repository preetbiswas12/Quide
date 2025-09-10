"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMHelper = void 0;
const generative_ai_1 = require("@google/generative-ai");
const fs_1 = __importDefault(require("fs"));
/**
 * LLMHelper
 *  – Generates a complete solution for any programming-related prompt.
 *  – Guarantees CODE is never empty (falls back to pseudocode if needed).
 */
class LLMHelper {
    model;
    /* ─────────────────────  SYSTEM PROMPT  ───────────────────── */
    systemPrompt = `
You are Cypher AI, a world-class coding assistant.

Output MUST follow this plain-text structure (use real line breaks):

PROBLEM : <summary>

REASONING : <why this solution works in each and every possible case.
                • Make the whole point in 4-5 lines.>

CODE : <ALWAYS include code.  
        • If the task asks for an implementation, give a full runnable snippet.  
        • If the task is conceptual, give a short illustrative snippet.
        • Make sure the given code runs in every possible situation and in each and every possible input.>

EXPLANATION : <what the code does / expected output.
               • Make the explanation in 3-4 lines.>

SUGGESTIONS : <optional>

Rules
• No markdown, no back-ticks, no \\n literals—use actual line breaks.
• Indent code properly (4 spaces for Python, 2 for JS/Java/Kotlin, etc.).
• Stay on topic; no extra narration outside the labelled sections.
`;
    constructor(apiKey) {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    }
    /* ---------- helper: file → inlineData ---------- */
    async fileToGenerativePart(path, mime = "image/png") {
        const buf = await fs_1.default.promises.readFile(path);
        return { inlineData: { data: buf.toString("base64"), mimeType: mime } };
    }
    /* ---------- helper: extract code from text ---------- */
    extractCode(text) {
        // JSON style first
        const j = text.match(/"code"\\s*:\\s*"([\\s\\S]*?)"/);
        if (j)
            return j[1].replace(/\\"/g, '"');
        // Plain-text fallback
        const p = text.match(/CODE\\s*:\\s*([\\s\\S]*?)(?:\\n[A-Z][A-Z0-9_ ]+\\s*:|$)/);
        return p?.[1]?.trim() || "";
    }
    /* ───────────────  IMAGES → PROBLEM (plain text)  ─────────────── */
    async extractProblemFromImages(imagePaths) {
        const parts = await Promise.all(imagePaths.map((p) => this.fileToGenerativePart(p)));
        const res = await this.model.generateContent([
            `${this.systemPrompt}\nAnalyse the image(s) and answer in the same structure.`,
            ...parts,
        ]);
        return { raw: res.response.text().trim() };
    }
    /* ───────────────  GENERATE SOLUTION  ─────────────── */
    async generateSolution(problemInfo) {
        const prompt = `${this.systemPrompt}

Here is the problem JSON (may contain text or screenshot analysis):
${JSON.stringify(problemInfo, null, 2)}

Return EITHER the exact plain-text structure above OR
the JSON object below (no markdown fences):

{
  "solution": {
    "code": "…",
    "problem_statement": "…",
    "context": "…",
    "suggested_responses": [ "…", "…" ],
    "reasoning": "…"
  }
}`;
        const res = await this.model.generateContent(prompt);
        const raw = res.response.text().trim();
        /* 1️⃣  Try JSON parse first */
        try {
            const parsed = JSON.parse(raw);
            if (parsed?.solution?.code?.trim())
                return { solution: parsed.solution, raw };
        }
        catch {
            /* fall through */
        }
        /* 2️⃣  Fallback: extract CODE from plain text */
        let code = this.extractCode(raw);
        /* 3️⃣  Guarantee non-empty code (pseudocode stub) */
        if (!code.trim()) {
            code = `// Pseudocode placeholder generated automatically\n// Gemini did not provide code for this conceptual task.\n// - Describe the main algorithm here\n// - Outline key functions / classes`;
        }
        return {
            solution: {
                code,
                problem_statement: "",
                context: "",
                suggested_responses: [],
                reasoning: "",
            },
            raw,
        };
    }
    /* ───────────────  DEBUG WITH IMAGES  ─────────────── */
    async debugSolutionWithImages(problemInfo, currentCode, debugImages) {
        const parts = await Promise.all(debugImages.map((p) => this.fileToGenerativePart(p)));
        const prompt = `${this.systemPrompt}
You are debugging the code below; provide an updated answer in the same structure.

CURRENT CODE:
${currentCode}`;
        const res = await this.model.generateContent([prompt, ...parts]);
        const raw = res.response.text().trim();
        return {
            old_code: currentCode,
            new_code: this.extractCode(raw) || "// No changes returned",
            raw,
        };
    }
    /* ───────────────  IMAGE / AUDIO HELPERS  ─────────────── */
    async analyzeImageFile(path) {
        const p = await this.fileToGenerativePart(path);
        const res = await this.model.generateContent([
            `${this.systemPrompt}\nDescribe this image.`,
            p,
        ]);
        return { raw: res.response.text().trim() };
    }
    async analyzeAudioFile(path) {
        const p = await this.fileToGenerativePart(path, "audio/mp3");
        const res = await this.model.generateContent([
            `${this.systemPrompt}\nSummarise this audio.`,
            p,
        ]);
        return { raw: res.response.text().trim() };
    }
    async analyzeAudioFromBase64(data, mimeType) {
        const part = { inlineData: { data, mimeType } };
        const res = await this.model.generateContent([
            `${this.systemPrompt}\nSummarise this audio.`,
            part,
        ]);
        return { raw: res.response.text().trim() };
    }
}
exports.LLMHelper = LLMHelper;
//# sourceMappingURL=LLMHelper.js.map