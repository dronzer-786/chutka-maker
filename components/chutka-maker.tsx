"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Columns,
  Rows,
  Download,
  Plus,
  Trash,
  Sparkle,
  Broom,
  NotePencil,
  FileText,
  SlidersHorizontal,
  Check,
  X,
  CircleNotch,
  Warning,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import {
  Field,
  FieldLabel,
  FieldGroup,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_SETTINGS,
  FONT_STACKS,
  type Block,
  type Settings,
} from "@/lib/types";
import { cleanMarkdown, hasMarkdown } from "@/lib/markdown";

const STORAGE_KEY = "chutka-maker:v1";

const SAMPLE_TEXT = `Photosynthesis — the process by which green plants convert light energy into chemical energy. Occurs in chloroplasts, primarily in leaf mesophyll cells. Equation: 6CO2 + 6H2O -> C6H12O6 + 6O2. Light-dependent reactions happen in the thylakoid membrane; the Calvin cycle happens in the stroma.

Newton's Laws: 1) An object stays at rest or in uniform motion unless acted on by a net external force. 2) F = ma, force equals mass times acceleration. 3) Every action has an equal and opposite reaction. These laws form the foundation of classical mechanics.

The French Revolution (1789-1799) began with the storming of the Bastille on 14 July 1789. Causes included financial crisis, social inequality under the Ancien Regime, and Enlightenment ideas. It ended with Napoleon's coup in 1799.

Mitosis stages: Prophase (chromosomes condense), Metaphase (alignment at the equatorial plate), Anaphase (sister chromatids separate), Telophase (nuclear envelopes reform), followed by cytokinesis.`;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

type PageItem = {
  id: string;
  blockId: string;
  text: string;
};

export default function ChutkaMaker() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [autoColumns, setAutoColumns] = useState(false);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("preview");
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cleanFeedback, setCleanFeedback] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI Formatting State
  const [formattingId, setFormattingId] = useState<string | null>(null);
  const [isFormattingAll, setIsFormattingAll] = useState(false);

  // Zoom & Scale for responsive A4 preview
  const [zoomMode, setZoomMode] = useState<"auto" | "100" | "75" | "50">("auto");
  const [autoScale, setAutoScale] = useState(1);
  const previewAreaRef = useRef<HTMLDivElement>(null);

  // Measurement DOM ref for pagination
  const measurerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageItem[][]>([[]]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data.blocks)) setBlocks(data.blocks);
          if (data.settings) {
            const merged = { ...DEFAULT_SETTINGS, ...data.settings };
            if (typeof data.settings.margin === "number" && data.settings.margin >= 12) {
              merged.margin = 3;
            }
            setSettings(merged);
          }
          if (typeof data.autoColumns === "boolean") setAutoColumns(data.autoColumns);
          if (typeof data.activeId === "string") setActiveId(data.activeId);
        } else {
          const id = uid();
          setBlocks([{ id, text: SAMPLE_TEXT }]);
          setActiveId(id);
        }
      } catch {
        // ignore corrupt storage
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ blocks, settings, autoColumns, activeId })
    );
  }, [ready, blocks, settings, autoColumns, activeId]);

  // Auto column count based on font size
  const suggestedColumns = settings.fontSize <= 8 ? 3 : settings.fontSize <= 10 ? 2 : 1;
  useEffect(() => {
    if (autoColumns) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings((s) =>
        s.columnCount === suggestedColumns ? s : { ...s, columnCount: suggestedColumns }
      );
    }
  }, [autoColumns, suggestedColumns]);

  // Responsive scale update for Preview tab
  useEffect(() => {
    const calculateScale = () => {
      if (!previewAreaRef.current) return;
      if (zoomMode !== "auto") {
        setAutoScale(parseInt(zoomMode) / 100);
        return;
      }
      const containerWidth = previewAreaRef.current.clientWidth - 8;
      const targetWidth = 794; // 210mm in px at 96dpi
      if (containerWidth < targetWidth && containerWidth > 0) {
        setAutoScale(Math.max(0.35, containerWidth / targetWidth));
      } else {
        setAutoScale(1);
      }
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, [zoomMode, activeTab, showSettingsSidebar]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const updateActiveText = useCallback(
    (text: string) => {
      setBlocks((prev) => {
        if (!activeId) {
          if (!text.trim()) return prev;
          const id = uid();
          setActiveId(id);
          return [...prev, { id, text }];
        }
        return prev.map((b) => (b.id === activeId ? { ...b, text } : b));
      });
    },
    [activeId]
  );

  const addBlock = () => {
    const id = uid();
    setBlocks((prev) => [...prev, { id, text: "" }]);
    setActiveId(id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const clearAllBlocks = () => {
    if (window.confirm("Are you sure you want to clear all answers?")) {
      const id = uid();
      setBlocks([{ id, text: "" }]);
      setActiveId(id);
    }
  };

  // Clean Markdown handlers
  const anyHasMarkdown = useMemo(
    () => blocks.some((b) => hasMarkdown(b.text)),
    [blocks]
  );

  const cleanAllMarkdown = () => {
    setBlocks((prev) =>
      prev.map((b) => ({ ...b, text: cleanMarkdown(b.text) }))
    );
    setCleanFeedback("Cleaned all markdown formatting!");
    setTimeout(() => setCleanFeedback(null), 2500);
  };

  const cleanBlockMarkdown = (id: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, text: cleanMarkdown(b.text) } : b))
    );
    setCleanFeedback("Cleaned markdown for answer!");
    setTimeout(() => setCleanFeedback(null), 2500);
  };

  // AI Auto Format handlers using NVIDIA NIM API
  const formatBlockWithAI = async (id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (!block || !block.text.trim()) return;

    setFormattingId(id);
    setAiError(null);

    try {
      const res = await fetch("/api/ai-format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: block.text }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setAiError(data.error || "AI formatting failed.");
        setTimeout(() => setAiError(null), 5000);
        return;
      }

      if (data.formattedText) {
        setBlocks((prev) =>
          prev.map((b) => (b.id === id ? { ...b, text: data.formattedText } : b))
        );
        setCleanFeedback("AI structured points & formatting cleanly!");
        setTimeout(() => setCleanFeedback(null), 2500);
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Failed to communicate with AI server.");
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setFormattingId(null);
    }
  };

  const formatAllWithAI = async () => {
    const blocksWithText = blocks.filter((b) => b.text.trim());
    if (blocksWithText.length === 0) return;

    setIsFormattingAll(true);
    setAiError(null);

    try {
      for (const b of blocksWithText) {
        setFormattingId(b.id);
        const res = await fetch("/api/ai-format", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: b.text }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setAiError(data.error || "AI formatting failed for one or more answers.");
          setTimeout(() => setAiError(null), 5000);
          break;
        }
        if (data.formattedText) {
          setBlocks((prev) =>
            prev.map((item) =>
              item.id === b.id ? { ...item, text: data.formattedText } : item
            )
          );
        }
      }
      setCleanFeedback("AI auto-formatted points for all answers!");
      setTimeout(() => setCleanFeedback(null), 2500);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Failed to communicate with AI server.");
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setFormattingId(null);
      setIsFormattingAll(false);
    }
  };

  // DOM pagination measurement: each answer block starts on a fresh A4 page
  useEffect(() => {
    if (!ready) return;
    const measurer = measurerRef.current;
    if (!measurer || blocks.length === 0) {
      setPages([[]]);
      return;
    }

    const currentPages: PageItem[][] = [];

    measurer.innerHTML = "";
    const flowContainer = document.createElement("div");
    flowContainer.className = "a4-flow";
    flowContainer.style.padding = `${settings.margin}mm`;
    flowContainer.style.columnCount = settings.mode === "column" ? String(settings.columnCount) : "1";
    flowContainer.style.columnGap = settings.mode === "column" ? `${settings.columnGap}mm` : "0mm";
    flowContainer.style.fontSize = `${settings.fontSize}pt`;
    flowContainer.style.lineHeight = String(settings.lineHeight);
    flowContainer.style.fontFamily = FONT_STACKS[settings.font];
    flowContainer.style.textAlign = settings.justify ? "justify" : "left";
    flowContainer.style.display = "block";
    measurer.appendChild(flowContainer);

    for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
      const b = blocks[bIdx];
      const trimmed = b.text.trim();

      if (!trimmed) {
        // Empty answer block creates a dedicated A4 page
        currentPages.push([{ id: `${b.id}-empty`, blockId: b.id, text: "" }]);
        continue;
      }

      const paras = trimmed.split(/\n\n+/);
      let pageForThisBlock: PageItem[] = [];

      flowContainer.innerHTML = "";

      for (let pIdx = 0; pIdx < paras.length; pIdx++) {
        const text = paras[pIdx];
        const item: PageItem = {
          id: `${b.id}-${pIdx}`,
          blockId: b.id,
          text,
        };

        const pEl = document.createElement("p");
        pEl.className = "whitespace-pre-wrap";
        pEl.style.marginBottom = `${settings.blockGap}mm`;
        if (settings.mode === "column") {
          pEl.style.breakInside = "avoid";
        }
        pEl.textContent = text;
        flowContainer.appendChild(pEl);

        // If this paragraph causes overflow and there is already content on this A4 page
        if (flowContainer.scrollHeight > flowContainer.clientHeight + 2 && pageForThisBlock.length > 0) {
          currentPages.push(pageForThisBlock);
          pageForThisBlock = [item];

          flowContainer.innerHTML = "";
          const newPEl = document.createElement("p");
          newPEl.className = "whitespace-pre-wrap";
          newPEl.style.marginBottom = `${settings.blockGap}mm`;
          if (settings.mode === "column") {
            newPEl.style.breakInside = "avoid";
          }
          newPEl.textContent = text;
          flowContainer.appendChild(newPEl);
        } else {
          pageForThisBlock.push(item);
        }
      }

      if (pageForThisBlock.length > 0) {
        currentPages.push(pageForThisBlock);
      }
    }

    setPages(currentPages.length > 0 ? currentPages : [[]]);
  }, [blocks, settings, ready]);

  const totalWords = useMemo(
    () =>
      blocks.reduce(
        (sum, b) =>
          sum + b.text.trim().split(/\s+/).filter(Boolean).length,
        0
      ),
    [blocks]
  );

  const exportPdf = () => {
    if (activeTab !== "preview") {
      setActiveTab("preview");
      setTimeout(() => {
        window.print();
      }, 100);
    } else {
      window.print();
    }
  };

  if (!ready) return null;

  // Settings Panel Component - Compact layout designed to fit fixed non-scrolling sidebar
  const SettingsPanelContent = (
    <div className="flex flex-col gap-3 text-xs select-none">
      <FieldGroup className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-2xs">
        <p className="text-[10px] font-bold tracking-[0.14em] text-zinc-400 uppercase mb-0.5">
          Flow &amp; Layout
        </p>
        <Field>
          <FieldLabel className="text-xs font-medium text-zinc-800">Flow direction</FieldLabel>
          <div className="grid grid-cols-2 gap-1 border border-zinc-200/80 rounded-lg p-0.5 bg-zinc-100/70">
            <button
              type="button"
              onClick={() => set("mode", "column")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${
                settings.mode === "column"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
            >
              <Columns className="size-3.5 shrink-0" />
              <span>Column</span>
            </button>
            <button
              type="button"
              onClick={() => set("mode", "row")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${
                settings.mode === "row"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
            >
              <Rows className="size-3.5 shrink-0" />
              <span>Row</span>
            </button>
          </div>
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="font-size" className="text-xs">Font size</FieldLabel>
            <span className="font-mono text-xs font-bold text-zinc-700">
              {settings.fontSize} pt
            </span>
          </div>
          <Slider
            id="font-size"
            min={6}
            max={14}
            step={0.5}
            value={settings.fontSize}
            onValueChange={(v) => set("fontSize", v as number)}
          />
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <FieldLabel htmlFor="auto-cols" className="text-xs">Auto columns</FieldLabel>
              <Sparkle className="size-3 text-zinc-400" aria-hidden />
            </div>
            <Switch
              id="auto-cols"
              checked={autoColumns}
              onCheckedChange={(c) => setAutoColumns(Boolean(c))}
            />
          </div>
          {settings.mode === "column" && !autoColumns && (
            <div className="flex flex-col gap-1 mt-1.5">
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="col-count" className="text-xs">Columns</FieldLabel>
                <span className="font-mono text-xs font-bold text-zinc-700">
                  {settings.columnCount}
                </span>
              </div>
              <Slider
                id="col-count"
                min={1}
                max={4}
                step={1}
                value={settings.columnCount}
                onValueChange={(v) => set("columnCount", v as number)}
              />
            </div>
          )}
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="line-height" className="text-xs">Line height</FieldLabel>
            <span className="font-mono text-xs font-bold text-zinc-700">
              {settings.lineHeight.toFixed(2)}
            </span>
          </div>
          <Slider
            id="line-height"
            min={1}
            max={2}
            step={0.05}
            value={settings.lineHeight}
            onValueChange={(v) => set("lineHeight", v as number)}
          />
        </Field>
      </FieldGroup>

      <FieldGroup className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-2xs">
        <p className="text-[10px] font-bold tracking-[0.14em] text-zinc-400 uppercase mb-0.5">
          Spacing &amp; Type
        </p>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="margin" className="text-xs">Page margin</FieldLabel>
            <span className="font-mono text-xs font-bold text-zinc-700">
              {settings.margin} mm
            </span>
          </div>
          <Slider
            id="margin"
            min={0}
            max={30}
            step={1}
            value={settings.margin}
            onValueChange={(v) => set("margin", v as number)}
          />
        </Field>

        {settings.mode === "column" && (
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="col-gap" className="text-xs">Column gap</FieldLabel>
              <span className="font-mono text-xs font-bold text-zinc-700">
                {settings.columnGap} mm
              </span>
            </div>
            <Slider
              id="col-gap"
              min={0}
              max={20}
              step={1}
              value={settings.columnGap}
              onValueChange={(v) => set("columnGap", v as number)}
            />
          </Field>
        )}

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="block-gap" className="text-xs">Answer spacing</FieldLabel>
            <span className="font-mono text-xs font-bold text-zinc-700">
              {settings.blockGap} mm
            </span>
          </div>
          <Slider
            id="block-gap"
            min={0}
            max={10}
            step={0.5}
            value={settings.blockGap}
            onValueChange={(v) => set("blockGap", v as number)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="font" className="text-xs">Font family</FieldLabel>
          <Select
            value={settings.font}
            onValueChange={(v) => set("font", v as Settings["font"])}
          >
            <SelectTrigger id="font" className="w-full h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sans">Geist Sans</SelectItem>
              <SelectItem value="serif">Georgia Serif</SelectItem>
              <SelectItem value="mono">Geist Mono</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="justify" className="text-xs">Justify text</FieldLabel>
            <Switch
              id="justify"
              checked={settings.justify}
              onCheckedChange={(c) => set("justify", Boolean(c))}
            />
          </div>
        </Field>
      </FieldGroup>
    </div>
  );

  return (
    <div className="h-[100dvh] bg-zinc-50 text-zinc-950 flex flex-col overflow-hidden print:h-auto print:overflow-visible print:block print:bg-white">
      {/* Hidden A4 Measurement container */}
      <div
        ref={measurerRef}
        className="print-hidden"
        style={{
          position: "fixed",
          top: "-9999px",
          left: "-9999px",
          width: "210mm",
          height: "297mm",
          boxSizing: "border-box",
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      />

      {/* Floating Progress Toast during AI Format All */}
      {isFormattingAll && (
        <div className="fixed bottom-14 right-6 z-50 flex items-center gap-3 bg-zinc-950 text-white px-4 py-3 rounded-xl shadow-2xl border border-zinc-800 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CircleNotch className="size-4 animate-spin text-zinc-300 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-zinc-100">AI Formatting in progress</span>
            <span className="text-[11px] font-mono text-zinc-400">Structuring points with &apos;-&apos; &amp; numbering...</span>
          </div>
        </div>
      )}

      {/* Sticky App Header */}
      <header className="print-hidden shrink-0 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl z-30">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
              chutka-maker
            </h1>
            <Badge variant="secondary" className="font-mono text-[11px] bg-zinc-100 text-zinc-700">
              {pages.length} page{pages.length > 1 ? "s" : ""} · A4
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addBlock}
              title="Add a new answer on a new A4 page"
              className="text-xs font-semibold bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100 shadow-2xs"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">New Answer (New Page)</span>
              <span className="sm:hidden">New Page</span>
            </Button>

            <Button
              variant={showSettingsSidebar ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowSettingsSidebar((prev) => !prev)}
              title="Toggle Live Settings Sidebar"
              className="text-xs"
            >
              <SlidersHorizontal className="size-4" />
              <span className="hidden sm:inline">
                {showSettingsSidebar ? "Hide Settings" : "Layout Settings"}
              </span>
            </Button>

            <Button
              variant={anyHasMarkdown ? "default" : "outline"}
              size="sm"
              disabled={!anyHasMarkdown}
              onClick={cleanAllMarkdown}
              title="Remove markdown formatting (#, **, code, etc.)"
              className={anyHasMarkdown ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm text-xs" : "opacity-60 text-xs"}
            >
              <Broom className="size-4" />
              <span className="hidden sm:inline">Clean Markdown</span>
            </Button>

            <Button size="sm" onClick={exportPdf} className="bg-zinc-900 text-white hover:bg-zinc-800 text-xs">
              <Download className="size-4" />
              <span className="hidden sm:inline">Export PDF</span>
            </Button>
          </div>
        </div>

        {/* Feedback & Error Banners */}
        {cleanFeedback && (
          <div className="bg-emerald-600 text-white text-xs font-medium py-1 px-4 text-center flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <Check className="size-3.5" />
            {cleanFeedback}
          </div>
        )}

        {aiError && (
          <div className="bg-amber-600 text-white text-xs font-medium py-1.5 px-4 text-center flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <Warning className="size-4 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-6 pb-2 pt-1">
          <nav className="flex items-center gap-1 border-b border-zinc-200/60 pb-1">
            <button
              onClick={() => setActiveTab("write")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "write"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              <NotePencil className="size-4" />
              <span>Write Answers</span>
              <Badge
                variant="secondary"
                className={`ml-1 text-[10px] px-1.5 py-0 ${
                  activeTab === "write"
                    ? "bg-zinc-800 text-zinc-200"
                    : "bg-zinc-200 text-zinc-700"
                }`}
              >
                {blocks.length}
              </Badge>
            </button>

            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                activeTab === "preview"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              <FileText className="size-4" />
              <span>Preview</span>
              <Badge
                variant="secondary"
                className={`ml-1 text-[10px] px-1.5 py-0 ${
                  activeTab === "preview"
                    ? "bg-zinc-800 text-zinc-200"
                    : "bg-zinc-200 text-zinc-700"
                }`}
              >
                {pages.length} A4
              </Badge>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container - Fixed 100vh shell without page scrollbar */}
      <main className="print-area mx-auto w-full max-w-[1400px] px-3 sm:px-6 py-3 flex-1 min-h-0 overflow-hidden print:h-auto print:overflow-visible print:block print:p-0 print:m-0 print:max-w-none">
        {/* TAB 1: WRITE ANSWERS */}
        <div
          className={`flex flex-col lg:flex-row gap-6 w-full h-full items-start overflow-hidden print-hidden ${
            activeTab === "write" ? "" : "hidden"
          }`}
        >
            {/* Settings Sidebar in Write view - Non-scrolling */}
            {showSettingsSidebar && (
              <aside className="print-hidden w-full lg:w-72 shrink-0 h-full overflow-hidden bg-white rounded-2xl border border-zinc-200/80 p-3.5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-100 shrink-0 bg-white z-10">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="size-4 text-zinc-700" />
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      Layout Settings
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowSettingsSidebar(false)}
                    className="text-zinc-400 hover:text-zinc-700"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                {SettingsPanelContent}
              </aside>
            )}

            {/* Answer Cards List - Scrollable */}
            <section className="print-hidden flex-1 h-full overflow-y-auto pr-1 flex flex-col gap-4 w-full">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-zinc-200/80 shadow-xs sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold tracking-tight text-zinc-900">
                    Answers List
                  </h2>
                  <span className="text-xs text-zinc-500 font-mono">
                    {totalWords} total words
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isFormattingAll || blocks.every((b) => !b.text.trim())}
                    onClick={formatAllWithAI}
                    className="text-xs font-medium text-zinc-800 border-zinc-300 bg-white hover:bg-zinc-100 shadow-xs"
                    title="Auto-format question numbering, points (-), & layout for all answers using NVIDIA AI"
                  >
                    {isFormattingAll ? (
                      <CircleNotch className="size-3.5 animate-spin text-zinc-900" />
                    ) : (
                      <Sparkle className="size-3.5 text-zinc-700" />
                    )}
                    {isFormattingAll ? "Formatting All..." : "AI Format All"}
                  </Button>

                  {anyHasMarkdown && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cleanAllMarkdown}
                      className="text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs"
                    >
                      <Broom className="size-3.5" />
                      Clean Markdown
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addBlock}
                    className="text-xs font-semibold border-zinc-300 text-zinc-800 hover:bg-zinc-100 shadow-2xs"
                    title="Add a new answer box on a new A4 page"
                  >
                    <Plus className="size-4" />
                    New Answer (New Page)
                  </Button>

                  {blocks.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllBlocks}
                      className="text-zinc-400 hover:text-red-600 hover:bg-red-50 text-xs"
                    >
                      Clear All
                    </Button>
                  )}
                </div>
              </div>

              {blocks.length === 0 ? (
                <Empty className="rounded-2xl border border-dashed border-zinc-300 bg-white py-12">
                  <EmptyHeader>
                    <EmptyTitle>No answers yet</EmptyTitle>
                    <EmptyDescription>
                      Write or paste your first answer below. Each answer box will be placed on its own A4 page.
                    </EmptyDescription>
                  </EmptyHeader>
                  <Button variant="outline" size="sm" onClick={addBlock} className="font-semibold">
                    <Plus className="size-4" />
                    Add First Answer (Page 1)
                  </Button>
                </Empty>
              ) : (
                <div className="flex flex-col gap-4 pb-4">
                  {blocks.map((b, i) => {
                    const blockHasMarkdown = hasMarkdown(b.text);
                    const wordCount = b.text.trim().split(/\s+/).filter(Boolean).length;
                    const isFormattingThis = formattingId === b.id;

                    return (
                      <div
                        key={b.id}
                        className={`group relative rounded-xl border transition-all duration-200 shadow-xs ${
                          isFormattingThis
                            ? "border-zinc-700 ring-2 ring-zinc-950/10 shadow-sm bg-zinc-50/50"
                            : b.id === activeId
                            ? "border-zinc-500 ring-2 ring-zinc-950/5 bg-white"
                            : "border-zinc-200 hover:border-zinc-300 bg-white"
                        }`}
                        onClick={() => setActiveId(b.id)}
                      >
                        {/* Top Sleek Progress Line during AI Formatting */}
                        {isFormattingThis && (
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-900 animate-pulse rounded-t-xl z-20" />
                        )}

                        <div className="flex items-center justify-between border-b border-zinc-100 px-3.5 py-2 bg-zinc-50/50 rounded-t-xl">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-zinc-700">
                              Answer #{String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="font-mono text-[10px] font-semibold text-zinc-600 bg-zinc-200/80 px-1.5 py-0.5 rounded">
                              Page {i + 1} · A4
                            </span>
                            <span className="font-mono text-[11px] text-zinc-400">
                              · {wordCount} word{wordCount === 1 ? "" : "s"}
                            </span>

                            {isFormattingThis && (
                              <span className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md">
                                <CircleNotch className="size-3 animate-spin text-zinc-900" />
                                Formatting layout &amp; points...
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Per-Card AI Format Button */}
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={isFormattingThis || !b.text.trim()}
                              onClick={(e) => {
                                e.stopPropagation();
                                formatBlockWithAI(b.id);
                              }}
                              className={`h-7 px-2.5 text-[11px] font-medium border-zinc-300 transition-all ${
                                isFormattingThis
                                  ? "bg-zinc-100 text-zinc-900 border-zinc-400"
                                  : "bg-white text-zinc-800 hover:bg-zinc-100"
                              }`}
                              title="Auto-format question numbering, points (-), & layout"
                            >
                              {isFormattingThis ? (
                                <CircleNotch className="size-3 animate-spin text-zinc-900" />
                              ) : (
                                <Sparkle className="size-3 text-zinc-700" />
                              )}
                              {isFormattingThis ? "Formatting..." : "AI Format"}
                            </Button>

                            {blockHasMarkdown && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cleanBlockMarkdown(b.id);
                                }}
                                className="h-7 px-2 text-[11px] text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
                                title="Strip markdown symbols from this answer"
                              >
                                <Broom className="size-3" />
                                Clean Markdown
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Delete answer ${i + 1}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeBlock(b.id);
                              }}
                              className="text-zinc-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <Textarea
                          value={b.text}
                          placeholder="Paste or write your answer here..."
                          className={`min-h-[110px] resize-y border-0 text-sm sm:text-base leading-relaxed p-3.5 shadow-none focus-visible:ring-0 rounded-b-xl transition-colors ${
                            isFormattingThis ? "bg-zinc-50/40 text-zinc-900" : ""
                          }`}
                          onChange={(e) => {
                            setActiveId(b.id);
                            updateActiveText(e.target.value);
                          }}
                          onFocus={() => setActiveId(b.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
        </div>

        {/* TAB 2: LIVE A4 PREVIEW WITH LIVE SETTINGS SIDEBAR */}
        <div
          className={`flex flex-col lg:flex-row gap-6 w-full h-full items-start overflow-hidden print:block print:h-auto print:overflow-visible ${
            activeTab === "preview" ? "" : "hidden print:block"
          }`}
        >
            {/* Live Settings Sidebar - Non-scrolling */}
            {showSettingsSidebar && (
              <aside className="print-hidden w-full lg:w-72 shrink-0 h-full overflow-hidden bg-white rounded-2xl border border-zinc-200/80 p-3.5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-100 shrink-0 bg-white z-10">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="size-4 text-zinc-700" />
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      Live Layout Settings
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowSettingsSidebar(false)}
                    className="text-zinc-400 hover:text-zinc-700"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>

                {SettingsPanelContent}
              </aside>
            )}

            {/* Live A4 Preview Stack - Scrollable */}
            <section
              ref={previewAreaRef}
              className="print-pages flex-1 h-full overflow-y-auto flex flex-col items-center gap-4 rounded-2xl bg-zinc-200/70 p-1 sm:p-1 w-full"
            >
              {/* Viewport Toolbar */}
              <div className="print-hidden flex flex-wrap items-center justify-between gap-3 w-full bg-white p-2.5 rounded-xl border border-zinc-200 shadow-xs sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  {!showSettingsSidebar && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setShowSettingsSidebar(true)}
                      className="text-xs bg-zinc-50 border-zinc-300"
                    >
                      <SlidersHorizontal className="size-3.5" />
                      Show Settings
                    </Button>
                  )}
                  <span className="text-xs font-semibold text-zinc-600">Zoom:</span>
                  <div className="flex items-center gap-1">
                    {(["auto", "100", "75", "50"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setZoomMode(mode)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                          zoomMode === mode
                            ? "bg-zinc-900 text-white shadow-2xs"
                            : "text-zinc-600 hover:bg-zinc-100"
                        }`}
                      >
                        {mode === "auto" ? "Auto Fit" : `${mode}%`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={addBlock}
                    className="text-xs bg-zinc-50 border-zinc-300 hover:bg-zinc-100 font-medium"
                    title="Add a new answer on a new A4 page"
                  >
                    <Plus className="size-3.5" />
                    <span>New Answer (New Page)</span>
                  </Button>
                  <Badge variant="outline" className="font-mono text-xs bg-zinc-50">
                    {pages.length} Sheet{pages.length > 1 ? "s" : ""} · 210×297 mm
                  </Badge>
                  <Button size="xs" onClick={exportPdf} className="bg-zinc-900 text-white">
                    <Download className="size-3.5" />
                    Print / PDF
                  </Button>
                </div>
              </div>

              {/* Multi-page A4 Display Stack */}
              <div className="print-page-stack flex flex-col items-center gap-8 w-full pb-6 print:gap-0 print:pb-0">
                {pages.map((pageItems, pageIdx) => {
                  const firstItem = pageItems[0];
                  const blockIndex = firstItem
                    ? blocks.findIndex((b) => b.id === firstItem.blockId)
                    : pageIdx;
                  const hasContent = pageItems.some((item) => item.text.trim());

                  return (
                    <div key={pageIdx} className="print-page-item flex flex-col items-center gap-2 w-full print:gap-0">
                      <div className="print-hidden flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-white/90 backdrop-blur font-mono text-[11px] border border-zinc-200/80 text-zinc-700 shadow-xs"
                        >
                          Page {pageIdx + 1} of {pages.length}
                          {blockIndex !== -1 && ` · Answer #${blockIndex + 1}`}
                        </Badge>
                      </div>

                      {/* Responsive scale wrapper */}
                      <div
                        className="print-scale-wrapper relative transition-all duration-150 flex justify-center"
                        style={{
                          width: `${autoScale * 210}mm`,
                          height: `${autoScale * 297}mm`,
                        }}
                      >
                        <div
                          className="a4-sheet shadow-2xl rounded-xs border border-zinc-200"
                          style={{
                            transform: `scale(${autoScale})`,
                            transformOrigin: "top left",
                          }}
                        >
                          <div
                            className="a4-flow"
                            style={{
                              padding: `${settings.margin}mm`,
                              columnCount: settings.mode === "column" ? settings.columnCount : 1,
                              columnGap: settings.mode === "column" ? `${settings.columnGap}mm` : "0mm",
                              fontSize: `${settings.fontSize}pt`,
                              lineHeight: settings.lineHeight,
                              fontFamily: FONT_STACKS[settings.font],
                              textAlign: settings.justify ? "justify" : "left",
                              hyphens: settings.justify ? "auto" : "manual",
                              display: "block",
                            }}
                          >
                            {hasContent ? (
                              pageItems
                                .filter((item) => item.text.trim())
                                .map((item) => (
                                  <p
                                    key={item.id}
                                    className="whitespace-pre-wrap"
                                    style={{
                                      marginBottom: `${settings.blockGap}mm`,
                                      ...(settings.mode === "column" ? { breakInside: "avoid" } : {}),
                                    }}
                                  >
                                    {item.text}
                                  </p>
                                ))
                            ) : (
                              <p className="print-hidden text-zinc-400 italic" style={{ fontSize: "10pt" }}>
                                {blockIndex !== -1
                                  ? `Answer #${blockIndex + 1} (Page ${pageIdx + 1}) will appear here, formatted onto this A4 sheet.`
                                  : "Your answers will appear here, formatted onto this A4 sheet."}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
        </div>
      </main>

      {/* App Footer - Permanently fixed at bottom of 100vh shell */}
      <footer className="print-hidden shrink-0 border-t border-zinc-200/80 bg-white/90 backdrop-blur-md py-2.5 text-center">
        <p className="text-xs text-zinc-500 font-medium">
          Built in exam pressure by{" "}
          <a
            href="https://taqui.in"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-zinc-800 underline underline-offset-2 hover:text-purple-600 transition-colors"
          >
            Taqui.in
          </a>
        </p>
      </footer>
    </div>
  );
}
