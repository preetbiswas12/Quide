import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "react-query";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";

import ScreenshotQueue from "./components/Queue/ScreenshotQueue";
import {
  Toast,
  ToastDescription,
  ToastMessage,
  ToastTitle,
  ToastVariant,
} from "./components/ui/toast";
import { ProblemStatementData } from "../types/solutions";
import SolutionCommands from "./components/Solutions/SolutionCommands";
import Debug from "./Debug";

/* ─────────────────────────────────────────── */

const SectionHeading = ({
  children,
  color,
}: {
  children: string;
  color: string;
}) => (
  <h2 className={`text-[12px] font-semibold tracking-wide ${color}`}>
    {children}
  </h2>
);

/* ---------- Generic coloured-text block ---------- */
export const ContentSection = ({
  title,
  content,
  isLoading,
  color = "text-blue-300",
}: {
  title: string;
  content: React.ReactNode;
  isLoading: boolean;
  color?: string;
}) => {
  const colorCycle = [
    "text-cyan-200",
  ];

  const renderColoredLines = (text: string) =>
    text
      .split("\n")
      .filter((l) => l.trim())
      .map((line, i) => (
        <div
          key={i}
          className={`text-[11px] leading-[1.5] ${
            colorCycle[i % colorCycle.length]
          }`}
        >
          {line}
        </div>
      ));

  return (
    <div className="space-y-2">
      <SectionHeading color={color}>{title}</SectionHeading>
      {isLoading ? (
        <p className="text-xs text-white animate-pulse">
          Loading {title.toLowerCase()}…
        </p>
      ) : (
        <div className="whitespace-pre-wrap">
          {typeof content === "string" ? renderColoredLines(content) : content}
        </div>
      )}
    </div>
  );
};

/* ---------- Code / solution block ---------- */
export const SolutionSection = ({
  title,
  content,
  isLoading,
}: {
  title: string;
  content: React.ReactNode;
  isLoading: boolean;
}) => (
  <div className="space-y-2">
    <SectionHeading color="text-green-200">{title}</SectionHeading>
    {isLoading ? (
      <p className="text-xs text-gray-400 animate-pulse">Loading solution…</p>
    ) : content && typeof content === "string" && content.trim() !== "" ? (
      <div className="rounded-lg overflow-hidden border border-white/10 bg-[#1e1e2e] shadow-lg">
        <SyntaxHighlighter
          showLineNumbers
          language="python"
          style={dracula}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "11px",
            borderRadius: "0.5rem",
          }}
          wrapLongLines
        >
          {content}
        </SyntaxHighlighter>
      </div>
    ) : (
      <p className="text-xs text-red-400">⚠️ No code returned by the AI.</p>
    )}
  </div>
);

/* ---------- Complexity block ---------- */
export const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading,
}: {
  timeComplexity: string | null;
  spaceComplexity: string | null;
  isLoading: boolean;
}) => (
  <div className="space-y-2">
    <SectionHeading color="text-violet-200">Complexity</SectionHeading>
    {isLoading ? (
      <p className="text-xs text-gray-400 animate-pulse">
        Calculating complexity…
      </p>
    ) : (
      <ul className="list-disc pl-5 text-[12px] text-gray-100 space-y-1">
        <li>
          <strong>Time:</strong> {timeComplexity}
        </li>
        <li>
          <strong>Space:</strong> {spaceComplexity}
        </li>
      </ul>
    )}
  </div>
);

/* ─────────────────────────────────────────── */
/*                   Main component           */
/* ─────────────────────────────────────────── */

const Solutions = ({
  setView,
}: {
  setView: React.Dispatch<
    React.SetStateAction<"queue" | "solutions" | "debug">
  >;
}) => {
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  /* ---- local state ---- */
  const [debugProcessing, setDebugProcessing] = useState(false);
  const [problemStatementData, setProblemStatementData] =
    useState<ProblemStatementData | null>(null);
  const [solutionData, setSolutionData] = useState<string | null>(null);
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null);
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  );
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  );
  const [isResetting, setIsResetting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral",
  });

  /* ---- extra screenshots ---- */
  const { data: extraScreenshots = [], refetch } = useQuery(
    ["extras"],
    async () => {
      try {
        return await window.electronAPI.getScreenshots();
      } catch {
        return [];
      }
    },
    { staleTime: Infinity, cacheTime: Infinity }
  );

  /* ---- toast helper ---- */
  const showToast = (
    title: string,
    description: string,
    variant: ToastVariant
  ) => {
    setToastMessage({ title, description, variant });
    setToastOpen(true);
  };

  /* ---- delete screenshot ---- */
  const handleDeleteExtraScreenshot = async (index: number) => {
    const shot = extraScreenshots[index];
    const res = await window.electronAPI.deleteScreenshot(shot.path);
    if (res.success) refetch();
    else console.error(res.error);
  };

  /* ---- initial mount / subscriptions ---- */
  useEffect(() => {
    /* auto-resize */
    const ro = new ResizeObserver(() => {
      if (contentRef.current) {
        const { scrollHeight: h, scrollWidth: w } = contentRef.current;
        window.electronAPI.updateContentDimensions({ width: w, height: h });
      }
    });
    if (contentRef.current) ro.observe(contentRef.current);

    /* event listeners */
    const cleanups = [
      window.electronAPI.onScreenshotTaken(() => refetch()),

      window.electronAPI.onResetView(() => {
        setIsResetting(true);
        queryClient.removeQueries(["solution", "new_solution"]);
        refetch();
        setTimeout(() => setIsResetting(false), 0);
      }),

      window.electronAPI.onSolutionStart(() => {
        setSolutionData(null);
        setThoughtsData(null);
        setTimeComplexityData(null);
        setSpaceComplexityData(null);
      }),

      window.electronAPI.onSolutionError((err: string) => {
        const fallback = queryClient.getQueryData(["solution"]) as any;
        if (!fallback) setView("queue");
        setSolutionData(fallback?.code || "// ⚠️ No code was returned");
        setThoughtsData(fallback?.thoughts || null);
        setTimeComplexityData(fallback?.time_complexity || null);
        setSpaceComplexityData(fallback?.space_complexity || null);
        showToast(
          "Processing Failed",
          "There was an error processing your screenshots.",
          "error"
        );
        console.error("Solution error:", err);
      }),

      window.electronAPI.onSolutionSuccess((data) => {
        const result = {
          code: data.solution.code || "// ⚠️ No code was returned",
          thoughts: data.solution.thoughts,
          time_complexity: data.solution.time_complexity,
          space_complexity: data.solution.space_complexity,
        };
        queryClient.setQueryData(["solution"], result);
        setSolutionData(result.code);
        setThoughtsData(result.thoughts);
        setTimeComplexityData(result.time_complexity);
        setSpaceComplexityData(result.space_complexity);
      }),

      window.electronAPI.onDebugStart(() => setDebugProcessing(true)),
      window.electronAPI.onDebugSuccess((d) => {
        queryClient.setQueryData(["new_solution"], d.solution);
        setDebugProcessing(false);
      }),
      window.electronAPI.onDebugError(() => {
        showToast("Debug Failed", "There was an error debugging your code.", "error");
        setDebugProcessing(false);
      }),
      window.electronAPI.onProcessingNoScreenshots(() =>
        showToast("No Screenshots", "There are no extra screenshots to process.", "neutral")
      ),
    ];

    return () => {
      ro.disconnect();
      cleanups.forEach((u) => u());
    };
  }, []);

  /* ---- cache subscription ---- */
  useEffect(() => {
    setProblemStatementData(queryClient.getQueryData(["problem_statement"]) || null);
    setSolutionData(queryClient.getQueryData(["solution"]) || null);

    const unsub = queryClient.getQueryCache().subscribe((ev) => {
      const key = ev?.query.queryKey[0];
      if (key === "problem_statement") {
        setProblemStatementData(queryClient.getQueryData(["problem_statement"]) || null);
      }
      if (key === "solution") {
        const sol = queryClient.getQueryData(["solution"]) as any;
        setSolutionData(sol?.code || "// ⚠️ No code was returned");
        setThoughtsData(sol?.thoughts);
        setTimeComplexityData(sol?.time_complexity);
        setSpaceComplexityData(sol?.space_complexity);
      }
    });

    return () => unsub();
  }, [queryClient]);

  /* ---- redirect to debug view if new_solution exists ---- */
  if (!isResetting && queryClient.getQueryData(["new_solution"])) {
    return (
      <Debug isProcessing={debugProcessing} setIsProcessing={setDebugProcessing} />
    );
  }

  /* ---- UI ---- */
  return (
    <div ref={contentRef} className="relative space-y-3 px-4 py-3">
      {/* Toast */}
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        variant={toastMessage.variant}
        duration={3000}
      >
        <ToastTitle>{toastMessage.title}</ToastTitle>
        <ToastDescription>{toastMessage.description}</ToastDescription>
      </Toast>

      {/* Screenshot queue */}
      {solutionData && (
        <div className="pb-3">
          <ScreenshotQueue
            isLoading={debugProcessing}
            screenshots={extraScreenshots}
            onDeleteScreenshot={handleDeleteExtraScreenshot}
          />
        </div>
      )}

      <SolutionCommands
        extraScreenshots={extraScreenshots}
        onTooltipVisibilityChange={() => {}}
      />

      {/* Main content */}
      <div className="w-full text-sm text-black bg-black/60 rounded-md">
        <div className="rounded-lg overflow-hidden">
          <div className="px-4 py-3 space-y-4 max-w-full">
            {problemStatementData?.validation_type === "manual" ? (
              <ContentSection
                title={
                  problemStatementData?.output_format?.subtype === "voice"
                    ? "Audio Result"
                    : "Screenshot Result"
                }
                content={problemStatementData.problem_statement}
                isLoading={false}
              />
            ) : (
              <>
                <ContentSection
                  title={
                    problemStatementData?.output_format?.subtype === "voice"
                      ? "Voice Input"
                      : "Problem Statement"
                  }
                  content={problemStatementData?.problem_statement}
                  isLoading={!problemStatementData}
                />

                {solutionData && thoughtsData && (
                  <ContentSection
                    title="Thoughts (Read these aloud)"
                    content={thoughtsData
                      .map((t) => `• ${t}`)
                      .join("\n")}
                    isLoading={!thoughtsData}
                  />
                )}

                {solutionData && (
                  <SolutionSection
                    title={
                      problemStatementData?.output_format?.subtype === "voice"
                        ? "Response"
                        : "Solution"
                    }
                    content={solutionData}
                    isLoading={!solutionData}
                  />
                )}

                {solutionData &&
                  problemStatementData?.output_format?.subtype !== "voice" && (
                    <ComplexitySection
                      timeComplexity={timeComplexityData}
                      spaceComplexity={spaceComplexityData}
                      isLoading={
                        !timeComplexityData || !spaceComplexityData
                      }
                    />
                  )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Solutions;
