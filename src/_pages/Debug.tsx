import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "react-query";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";
import { diffLines } from "diff";

import { ContentSection } from "./Solutions";
import ScreenshotQueue from "./components/Queue/ScreenshotQueue";
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastMessage,
  ToastVariant,
} from "./components/ui/toast";
import ExtraScreenshotsQueueHelper from "./components/Solutions/SolutionCommands";

interface DebugProps {
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
}

/* ─────────────────────────────────────────── */

const CodeComparison = ({
  oldCode,
  newCode,
}: {
  oldCode: string;
  newCode: string;
}) => {
  /* build diff tables */
  const { leftLines, rightLines } = (() => {
    const diff = diffLines(oldCode || "", newCode || "", {
      newlineIsToken: true,
      ignoreWhitespace: true,
    });

    const left: { value: string; removed?: boolean }[] = [];
    const right: { value: string; added?: boolean }[] = [];

    for (const part of diff) {
      const lines = part.value.split("\n").filter(Boolean);

      if (part.added) {
        left.push(...Array(lines.length).fill({ value: "" }));
        right.push(...lines.map((l) => ({ value: l, added: true })));
      } else if (part.removed) {
        left.push(...lines.map((l) => ({ value: l, removed: true })));
        right.push(...Array(lines.length).fill({ value: "" }));
      } else {
        left.push(...lines.map((l) => ({ value: l })));
        right.push(...lines.map((l) => ({ value: l })));
      }
    }

    return { leftLines: left, rightLines: right };
  })();

  return (
    <div className="space-y-2">
      <h2 className="text-[14px] font-medium text-yellow-300 tracking-wide">
        🔁 Code Comparison
      </h2>

      <div className="flex bg-[#161b22] rounded-lg overflow-hidden text-sm">
        {/* Previous */}
        <div className="w-1/2 border-r border-gray-700">
          <div className="bg-[#2d333b] px-3 py-1.5 text-[11px] font-medium text-gray-200">
            Previous
          </div>
          <SyntaxHighlighter
            language="python"
            style={dracula}
            showLineNumbers
            wrapLines
            customStyle={{
              margin: 0,
              padding: "1rem",
              background: "transparent",
              fontSize: "10px",
            }}
            lineProps={(n) => {
              const line = leftLines[n - 1];
              return {
                style: {
                  display: "block",
                  backgroundColor: line?.removed
                    ? "rgba(255,0,0,0.15)"
                    : "transparent",
                },
              };
            }}
          >
            {leftLines.map((l) => l.value).join("\n") ||
              "// ⚠️ No previous code"}
          </SyntaxHighlighter>
        </div>

        {/* Updated */}
        <div className="w-1/2">
          <div className="bg-[#2d333b] px-3 py-1.5 text-[11px] font-medium text-gray-200">
            Updated
          </div>
          <SyntaxHighlighter
            language="python"
            style={dracula}
            showLineNumbers
            wrapLines
            customStyle={{
              margin: 0,
              padding: "1rem",
              background: "transparent",
              fontSize: "10px",
            }}
            lineProps={(n) => {
              const line = rightLines[n - 1];
              return {
                style: {
                  display: "block",
                  backgroundColor: line?.added
                    ? "rgba(0,255,0,0.15)"
                    : "transparent",
                },
              };
            }}
          >
            {rightLines.map((l) => l.value).join("\n") ||
              "// ⚠️ No updated code"}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────── */

const Debug: React.FC<DebugProps> = ({ isProcessing, setIsProcessing }) => {
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  /* state */
  const [oldCode, setOldCode] = useState<string>("// ⚠️ No previous code");
  const [newCode, setNewCode] = useState<string>("// ⚠️ No updated code");
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState<string[]>([]);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral",
  });

  /* screenshots for extra context */
  const { data: screenshots = [], refetch } = useQuery({
    queryKey: ["extras"],
    queryFn: () => window.electronAPI.getScreenshots(),
    staleTime: Infinity,
    cacheTime: Infinity,
  });

  /* initial load & subscriptions */
  useEffect(() => {
    /* seed from cache */
    const cached = queryClient.getQueryData(["new_solution"]) as any;
    if (cached) {
      setOldCode(cached.old_code || "// ⚠️ No previous code");
      setNewCode(cached.new_code || "// ⚠️ No updated code");
      setThoughts(cached.thoughts || []);
      setReasoning(cached.reasoning || []);
      setIsProcessing(false);
    }

    /* events */
    const cleanup = [
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onDebugStart(() => setIsProcessing(true)),
      window.electronAPI.onDebugSuccess((d) => {
        setIsProcessing(false);
        setNewCode(d.new_code || "// ⚠️ No updated code");
        setThoughts(d.thoughts || []);
        setReasoning(d.reasoning || []);
      }),
      window.electronAPI.onDebugError(() => {
        setToastMessage({
          title: "Error",
          description: "Something went wrong debugging the code.",
          variant: "error",
        });
        setToastOpen(true);
        setIsProcessing(false);
      }),
    ];

    /* auto-resize */
    const ro = new ResizeObserver(() => {
      const h = contentRef.current?.scrollHeight || 0;
      const w = contentRef.current?.scrollWidth || 0;
      window.electronAPI.updateContentDimensions({ width: w, height: h });
    });
    if (contentRef.current) ro.observe(contentRef.current);

    return () => {
      ro.disconnect();
      cleanup.forEach((fn) => fn());
    };
  }, []);

  /* UI */
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
      <ScreenshotQueue
        screenshots={screenshots}
        onDeleteScreenshot={(i) =>
          window.electronAPI
            .deleteScreenshot(screenshots[i].path)
            .then(() => refetch())
        }
        isLoading={isProcessing}
      />

      <ExtraScreenshotsQueueHelper
        extraScreenshots={screenshots}
        onTooltipVisibilityChange={() => {}}
      />

      {/* Main debug content */}
      <div className="w-full bg-black/60 text-white rounded-md overflow-hidden px-4 py-4 space-y-6 text-[9px]">
        <ContentSection
          title="💡 What I Changed"
          content={
            thoughts.length
              ? thoughts.map((t, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2" />
                    <span>{t}</span>
                  </div>
                ))
              : "// ⚠️ No thoughts returned"
          }
          isLoading={!thoughts.length}
        />

        {reasoning.length > 0 && (
          <ContentSection
            title="🧠 Reasoning"
            content={reasoning.map((r, i) => (
              <div key={i}>{r}</div>
            ))}
            isLoading={false}
          />
        )}

        <CodeComparison oldCode={oldCode} newCode={newCode} />
      </div>
    </div>
  );
};

export default Debug;
