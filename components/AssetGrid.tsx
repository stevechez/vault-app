// components/AssetGrid.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  setAssetRating,
  batchSetRating,
  setAssetPersona,
  batchSetPersona,
  toggleArchiveAsset,
  batchArchiveAssets,
  updateAssetPrompt,
} from "@/app/actions";
import {
  Star,
  Trash2,
  UploadCloud,
  X,
  Download,
  Maximize2,
  FolderOpen,
  SlidersHorizontal,
  Columns2,
  CheckSquare,
  Square,
} from "lucide-react";
import { useRouter } from "next/navigation";

export interface AssetItem {
  id: string;
  filePath: string;
  fileName: string;
  persona: string | null;
  rating: number;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  promptText: string | null;
  createdAt: Date | string;
  isArchived: boolean;
}

const PERSONA_HOTKEYS: Record<string, string> = {
  h: "Hallie",
  k: "Kira",
  m: "Mia",
};

export function AssetGrid({ initialAssets }: { initialAssets: AssetItem[] }) {
  const [assets, setAssets] = useState<AssetItem[]>(initialAssets);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // UI state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filters
  const [filterPersona, setFilterPersona] = useState<string>("ALL");
  const [minRating, setMinRating] = useState<number>(0);

  // Modals & Panels
  const [isQuickLookOpen, setIsQuickLookOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorPrompt, setInspectorPrompt] = useState<string>("");

  const [, startTransition] = useTransition();
  const parentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setAssets(initialAssets);
  }, [initialAssets]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesPersona =
        filterPersona === "ALL" ||
        (filterPersona === "UNASSIGNED"
          ? !asset.persona
          : asset.persona === filterPersona);
      const matchesRating = asset.rating >= minRating;
      return matchesPersona && matchesRating;
    });
  }, [assets, filterPersona, minRating]);

  const currentFocusedAsset = filteredAssets[selectedIndex];

  // Sync inspector prompt when focused asset changes
  useEffect(() => {
    if (currentFocusedAsset) {
      setInspectorPrompt(currentFocusedAsset.promptText || "");
    }
  }, [currentFocusedAsset?.id]);

  useEffect(() => {
    if (selectedIndex >= filteredAssets.length) {
      setSelectedIndex(Math.max(0, filteredAssets.length - 1));
    }
  }, [filteredAssets.length, selectedIndex]);

  const COLUMNS = 5;
  const rowCount = Math.ceil(filteredAssets.length / COLUMNS);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 330,
    overscan: 3,
  });

  // Reveal in macOS Finder
  const handleRevealInFinder = async (filePath?: string) => {
    const targetPath = filePath || currentFocusedAsset?.filePath;
    if (!targetPath) return;

    try {
      await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: targetPath }),
      });
    } catch (err) {
      console.error("Finder reveal failed:", err);
    }
  };

  // Export selected or multi-selected to WebP
  const handleExport = async () => {
    const targetIds =
      selectedIds.size > 0
        ? Array.from(selectedIds)
        : currentFocusedAsset
          ? [currentFocusedAsset.id]
          : [];

    if (targetIds.length === 0) return;

    setIsExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: targetIds, format: "webp" }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Exported ${data.count} asset(s) to WebP in ${data.destination}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  // Save prompt text
  const handleSavePrompt = () => {
    if (!currentFocusedAsset) return;
    setAssets((prev) =>
      prev.map((a) =>
        a.id === currentFocusedAsset.id
          ? { ...a, promptText: inspectorPrompt }
          : a,
      ),
    );
    startTransition(() => {
      updateAssetPrompt(currentFocusedAsset.id, inspectorPrompt);
    });
  };

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName))
        return;

      // Select All: Cmd + A
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
        return;
      }

      // Deselect all: Escape (if no modals open)
      if (e.key === "Escape") {
        if (isQuickLookOpen) {
          setIsQuickLookOpen(false);
          return;
        }
        if (isCompareOpen) {
          setIsCompareOpen(false);
          return;
        }
        if (selectedIds.size > 0) {
          setSelectedIds(new Set());
          return;
        }
      }

      // Space: Quick Look
      if (e.code === "Space") {
        e.preventDefault();
        if (filteredAssets.length > 0) {
          setIsQuickLookOpen((prev) => !prev);
        }
        return;
      }

      // C: Side-by-Side Compare (requires at least 2 in multi-select or current + previous)
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setIsCompareOpen((prev) => !prev);
        return;
      }

      // I: Inspector Drawer
      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
        return;
      }

      // O: Reveal in Finder
      if (e.key.toLowerCase() === "o") {
        e.preventDefault();
        handleRevealInFinder();
        return;
      }

      // E: Export
      if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        handleExport();
        return;
      }

      if (filteredAssets.length === 0) return;
      const current = filteredAssets[selectedIndex];
      if (!current) return;

      const key = e.key.toLowerCase();

      // Navigation
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredAssets.length - 1),
        );
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + COLUMNS, filteredAssets.length - 1),
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - COLUMNS, 0));
        return;
      }

      // Batch or single rating: 0-5
      if (["0", "1", "2", "3", "4", "5"].includes(key)) {
        e.preventDefault();
        const rating = parseInt(key, 10);
        const targetIds =
          selectedIds.size > 0 ? Array.from(selectedIds) : [current.id];

        setAssets((prev) =>
          prev.map((item) =>
            targetIds.includes(item.id) ? { ...item, rating } : item,
          ),
        );
        startTransition(() => {
          if (targetIds.length === 1) setAssetRating(targetIds[0], rating);
          else batchSetRating(targetIds, rating);
        });
        return;
      }

      // Batch or single persona: H, K, M
      if (PERSONA_HOTKEYS[key]) {
        e.preventDefault();
        const persona = PERSONA_HOTKEYS[key];
        const targetIds =
          selectedIds.size > 0 ? Array.from(selectedIds) : [current.id];

        setAssets((prev) =>
          prev.map((item) =>
            targetIds.includes(item.id) ? { ...item, persona } : item,
          ),
        );
        startTransition(() => {
          if (targetIds.length === 1) setAssetPersona(targetIds[0], persona);
          else batchSetPersona(targetIds, persona);
        });
        return;
      }

      // Batch or single archive: Backspace / X
      if (e.key === "Backspace" || key === "x") {
        e.preventDefault();
        const targetIds =
          selectedIds.size > 0 ? Array.from(selectedIds) : [current.id];

        setAssets((prev) => prev.filter((a) => !targetIds.includes(a.id)));
        setSelectedIds(new Set());
        setSelectedIndex((prev) =>
          Math.min(
            prev,
            Math.max(0, filteredAssets.length - targetIds.length - 1),
          ),
        );
        startTransition(() => {
          if (targetIds.length === 1) toggleArchiveAsset(targetIds[0], true);
          else batchArchiveAssets(targetIds, true);
        });
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedIndex,
    filteredAssets,
    selectedIds,
    isQuickLookOpen,
    isCompareOpen,
  ]);

  // Keep focus in view
  useEffect(() => {
    if (!parentRef.current || filteredAssets.length === 0) return;
    const rowIndex = Math.floor(selectedIndex / COLUMNS);
    rowVirtualizer.scrollToIndex(rowIndex, { align: "auto" });
  }, [selectedIndex, rowVirtualizer, COLUMNS, filteredAssets.length]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (droppedFiles.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    droppedFiles.forEach((file) => formData.append("files", file));

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // Click card with multi-select support (Shift/Cmd)
  const handleCardClick = (index: number, id: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      const start = Math.min(selectedIndex, index);
      const end = Math.max(selectedIndex, index);
      const rangeIds = new Set(selectedIds);
      for (let i = start; i <= end; i++) {
        rangeIds.add(filteredAssets[i].id);
      }
      setSelectedIds(rangeIds);
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
    } else {
      setSelectedIndex(index);
    }
  };

  // Compare candidates (either 2 selected, or selected + adjacent)
  const compareAssets = useMemo(() => {
    if (selectedIds.size >= 2) {
      return filteredAssets.filter((a) => selectedIds.has(a.id)).slice(0, 2);
    }
    if (filteredAssets.length >= 2) {
      const current = filteredAssets[selectedIndex];
      const other = filteredAssets[selectedIndex === 0 ? 1 : selectedIndex - 1];
      return [current, other];
    }
    return [];
  }, [selectedIds, filteredAssets, selectedIndex]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-screen w-full flex-col bg-neutral-950 text-neutral-100 select-none overflow-hidden"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm border-2 border-dashed border-emerald-500 m-4 rounded-2xl">
          <UploadCloud className="h-16 w-16 text-emerald-400 animate-bounce mb-3" />
          <h2 className="text-xl font-bold text-white tracking-wide">
            Drop images to strip metadata & ingest
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Sharp will drop C2PA/EXIF and add to your local vault.
          </p>
        </div>
      )}

      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between border-b border-neutral-800 bg-neutral-900/60 px-6 py-2.5 backdrop-blur-md gap-3">
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm font-semibold tracking-wider text-emerald-400">
            VAULT // LOCAL
          </span>

          {/* Persona Filter Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-neutral-950 p-1 border border-neutral-800 text-xs font-mono">
            {["ALL", "Hallie", "Kira", "Mia", "UNASSIGNED"].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPersona(p)}
                className={`rounded px-2.5 py-1 transition-colors ${
                  filterPersona === p
                    ? "bg-neutral-800 font-medium text-emerald-400 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Min Rating Filter */}
          <div className="flex items-center gap-1 rounded-lg bg-neutral-950 p-1 border border-neutral-800 text-xs font-mono">
            <span className="px-2 text-neutral-500">Min:</span>
            {[0, 1, 2, 3, 4, 5].map((stars) => (
              <button
                key={stars}
                onClick={() => setMinRating(stars)}
                className={`rounded px-2 py-1 transition-colors ${
                  minRating === stars
                    ? "bg-amber-500/20 font-bold text-amber-400 border border-amber-500/30"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {stars === 0 ? "Any" : `${stars}★`}
              </button>
            ))}
          </div>

          {selectedIds.size > 0 && (
            <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-xs font-mono text-emerald-300">
              {selectedIds.size} Selected
            </span>
          )}
        </div>

        {/* Hotkey Guide & Actions */}
        <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
          <div>
            <kbd className="rounded bg-neutral-800 px-1 py-0.5 text-neutral-200">
              Space
            </kbd>{" "}
            Preview
          </div>
          <div>
            <kbd className="rounded bg-neutral-800 px-1 py-0.5 text-neutral-200">
              C
            </kbd>{" "}
            A/B Compare
          </div>
          <div>
            <kbd className="rounded bg-neutral-800 px-1 py-0.5 text-neutral-200">
              I
            </kbd>{" "}
            Inspector
          </div>
          <div>
            <kbd className="rounded bg-neutral-800 px-1 py-0.5 text-neutral-200">
              O
            </kbd>{" "}
            Finder
          </div>

          <button
            onClick={() => handleExport()}
            disabled={
              (!currentFocusedAsset && selectedIds.size === 0) || isExporting
            }
            className="flex items-center gap-1.5 rounded bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export {selectedIds.size > 0 ? `(${selectedIds.size})` : "WebP"}
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Virtual Grid Area */}
        <div ref={parentRef} className="flex-1 overflow-y-auto px-6 py-6">
          {filteredAssets.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-neutral-500 border border-neutral-800/60 rounded-xl border-dashed m-6">
              <UploadCloud className="mb-3 h-10 w-10 text-neutral-600" />
              <p className="text-lg font-medium text-neutral-300">
                No matching assets
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Adjust filters or drop images onto this screen.
              </p>
            </div>
          ) : (
            <div
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const startIndex = virtualRow.index * COLUMNS;
                const rowItems = filteredAssets.slice(
                  startIndex,
                  startIndex + COLUMNS,
                );

                return (
                  <div
                    key={virtualRow.key}
                    className="absolute left-0 top-0 grid w-full grid-cols-5 gap-4"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${virtualRow.size}px`,
                    }}
                  >
                    {rowItems.map((asset, colIdx) => {
                      const currentIndex = startIndex + colIdx;
                      const isFocused = currentIndex === selectedIndex;
                      const isMultiSelected = selectedIds.has(asset.id);

                      return (
                        <div
                          key={asset.id}
                          onClick={(e) =>
                            handleCardClick(currentIndex, asset.id, e)
                          }
                          onDoubleClick={() => setIsQuickLookOpen(true)}
                          className={`group relative flex flex-col overflow-hidden rounded-xl border bg-neutral-900 transition-all cursor-pointer ${
                            isMultiSelected
                              ? "border-emerald-400 ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/20"
                              : isFocused
                                ? "border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10"
                                : "border-neutral-800/80 hover:border-neutral-700"
                          }`}
                        >
                          <div className="relative h-56 w-full overflow-hidden bg-neutral-950">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/media/${asset.filePath}`}
                              alt={asset.fileName}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />

                            {/* Checkbox for visual multi-select */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = new Set(selectedIds);
                                if (next.has(asset.id)) next.delete(asset.id);
                                else next.add(asset.id);
                                setSelectedIds(next);
                              }}
                              className="absolute left-2 top-2 rounded bg-neutral-950/70 p-1 text-neutral-300 hover:text-white"
                            >
                              {isMultiSelected ? (
                                <CheckSquare className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Square className="h-4 w-4 opacity-50 hover:opacity-100" />
                              )}
                            </button>

                            {/* Persona Badge */}
                            {asset.persona && (
                              <span className="absolute left-8 top-2 rounded-md bg-neutral-900/90 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-emerald-400 backdrop-blur-sm border border-emerald-500/30">
                                {asset.persona}
                              </span>
                            )}

                            {/* Hover Quick Actions */}
                            <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRevealInFinder(asset.filePath);
                                }}
                                className="rounded-md bg-neutral-900/80 p-1.5 text-neutral-400 hover:text-white"
                                title="Reveal in Finder (O)"
                              >
                                <FolderOpen className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedIndex(currentIndex);
                                  setIsQuickLookOpen(true);
                                }}
                                className="rounded-md bg-neutral-900/80 p-1.5 text-neutral-400 hover:text-white"
                                title="Quick Look (Space)"
                              >
                                <Maximize2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssets((prev) =>
                                    prev.filter((a) => a.id !== asset.id),
                                  );
                                  startTransition(() => {
                                    toggleArchiveAsset(asset.id, true);
                                  });
                                }}
                                className="rounded-md bg-neutral-900/80 p-1.5 text-neutral-400 hover:text-red-400"
                                title="Archive (⌫)"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-2.5 text-xs">
                            <span className="truncate text-neutral-400 font-mono text-[11px]">
                              {asset.fileName}
                            </span>
                            <div className="flex items-center gap-0.5 text-amber-400">
                              {[1, 2, 3, 4, 5].map((starVal) => (
                                <Star
                                  key={starVal}
                                  className={`h-3 w-3 ${
                                    starVal <= asset.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-neutral-700"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Feature 3: Smart Prompt & Inspector Drawer (I) */}
        {isInspectorOpen && currentFocusedAsset && (
          <aside className="w-80 border-l border-neutral-800 bg-neutral-900/80 p-4 font-mono text-xs flex flex-col justify-between backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                  INSPECTOR
                </span>
                <button
                  onClick={() => setIsInspectorOpen(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <span className="text-neutral-500 block">File Name</span>
                  <span className="text-neutral-300 break-all">
                    {currentFocusedAsset.fileName}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Dimensions</span>
                  <span className="text-neutral-300">
                    {currentFocusedAsset.width} × {currentFocusedAsset.height} (
                    {currentFocusedAsset.aspectRatio?.toFixed(2)} ratio)
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Persona</span>
                  <span className="text-emerald-400 font-semibold">
                    {currentFocusedAsset.persona || "Unassigned"}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Rating</span>
                  <span className="text-amber-400">
                    {currentFocusedAsset.rating} / 5 Stars
                  </span>
                </div>

                <div className="pt-2">
                  <label className="text-neutral-400 block mb-1.5 font-semibold">
                    Generation Prompt / Seed
                  </label>
                  <textarea
                    value={inspectorPrompt}
                    onChange={(e) => setInspectorPrompt(e.target.value)}
                    placeholder="Paste prompt, negative prompt, or seed here..."
                    className="w-full h-36 rounded-lg border border-neutral-700 bg-neutral-950 p-2.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSavePrompt}
                    className="mt-2 w-full rounded bg-emerald-600/30 border border-emerald-500/50 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-600/40"
                  >
                    Save Prompt Metadata
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleRevealInFinder(currentFocusedAsset.filePath)}
              className="flex items-center justify-center gap-2 rounded bg-neutral-800 py-2 text-neutral-300 hover:bg-neutral-700"
            >
              <FolderOpen className="h-4 w-4" />
              Reveal in Finder (O)
            </button>
          </aside>
        )}
      </div>

      {/* Feature 2: A/B Comparison Split-View (C) */}
      {isCompareOpen && compareAssets.length >= 2 && (
        <div
          onClick={() => setIsCompareOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[85vh] w-[95vw] flex-col rounded-2xl border border-neutral-800 bg-neutral-950 p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Columns2 className="h-4 w-4" />A / B COMPARISON MODE
              </div>
              <button
                onClick={() => setIsCompareOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1 mt-4 overflow-hidden">
              {compareAssets.map((asset, i) => (
                <div
                  key={asset.id}
                  className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/50 p-2 overflow-hidden"
                >
                  <span className="text-xs font-mono text-neutral-400 mb-2">
                    Option {i === 0 ? "A" : "B"}: {asset.fileName} (
                    {asset.rating}★)
                  </span>
                  <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/media/${asset.filePath}`}
                      alt={asset.fileName}
                      className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spacebar Quick-Look Lightbox Modal */}
      {isQuickLookOpen && currentFocusedAsset && (
        <div
          onClick={() => setIsQuickLookOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-full max-w-6xl flex-col rounded-2xl border border-neutral-800 bg-neutral-950 p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 font-mono text-xs text-neutral-400">
              <div className="flex items-center gap-3">
                <span className="text-white font-medium">
                  {currentFocusedAsset.fileName}
                </span>
                {currentFocusedAsset.persona && (
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 border border-emerald-500/40">
                    {currentFocusedAsset.persona}
                  </span>
                )}
                {currentFocusedAsset.width && currentFocusedAsset.height && (
                  <span>
                    {currentFocusedAsset.width} × {currentFocusedAsset.height}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleRevealInFinder(currentFocusedAsset.filePath)
                  }
                  className="flex items-center gap-1.5 rounded bg-neutral-800 px-3 py-1 text-neutral-200 hover:bg-neutral-700"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Finder (O)
                </button>
                <button
                  onClick={() => handleExport()}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 rounded bg-emerald-600/30 border border-emerald-500/50 px-3 py-1 text-emerald-300 hover:bg-emerald-600/40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export WebP (E)
                </button>
                <button
                  onClick={() => setIsQuickLookOpen(false)}
                  className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="relative mt-3 flex items-center justify-center overflow-hidden max-h-[75vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media/${currentFocusedAsset.filePath}`}
                alt={currentFocusedAsset.fileName}
                className="max-h-[75vh] w-auto rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
