"use client";

import { useState, useCallback, useEffect } from "react";
import { GraphCanvas } from "@/components/GraphCanvas";
import type { GraphDto } from "common/dto";

export default function Home() {
  const [graph, setGraph] = useState<GraphDto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [graphName, setGraphName] = useState("main");
  const [savedGraphs, setSavedGraphs] = useState<{ id: string; name: string; createdAt: string }[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [selectedGraphId, setSelectedGraphId] = useState("");

  const loadGraph = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/graph/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load graph");
      setGraph(data.graph);
      setSelectedGraphId(data.graph?.id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load graph");
    }
  }, []);

  const loadGraphList = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/graphs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to list graphs");
      const graphs = data.graphs ?? [];
      setSavedGraphs(graphs);
      setListLoaded(true);
      if (!graph && graphs.length > 0) {
        await loadGraph(graphs[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list graphs");
    }
  }, [graph, loadGraph]);

  useEffect(() => {
    void loadGraphList();
  }, [loadGraphList]);

  const handleUpload = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setNotice(null);
      const form = e.currentTarget;
      const fileInput = form.querySelector<HTMLInputElement>('input[name="file"]');
      const file = fileInput?.files?.[0];
      if (!file) {
        setError("Please select a ZIP file containing .tf files.");
        return;
      }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("name", graphName.trim() || "main");

        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        setNotice(data.message || "Upload completed.");
        setSelectedGraphId(data.graphId);
        await loadGraph(data.graphId);
        await loadGraphList();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [graphName, loadGraph, loadGraphList]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.2),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.22),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_55%,_#f1f5f9_100%)]">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Terraform Visualizer</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">DrawTform</h1>
          </div>
          <p className="hidden text-sm text-slate-600 md:block">Upload Terraform ZIP and inspect infrastructure relationships</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-[0_24px_48px_-36px_rgba(15,23,42,0.65)] backdrop-blur-xl">
          <div className="mb-5 flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Upload Terraform Modules</h2>
            <p className="text-sm text-slate-600">Works best with folders containing `.tf` files. Complex nested blocks are supported.</p>
          </div>

          <form onSubmit={handleUpload} className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr_auto] md:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Graph name</span>
              <input
                type="text"
                name="name"
                value={graphName}
                onChange={(e) => setGraphName(e.target.value)}
                placeholder="prod / staging / main"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Terraform ZIP</span>
              <input
                type="file"
                name="file"
                accept=".zip"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-slate-700"
              />
            </label>

            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? "Building graph..." : "Upload & Build"}
            </button>
          </form>

          {notice && <p className="mt-3 text-sm text-emerald-700">{notice}</p>}
          {error && (
            <p className="mt-3 text-sm text-rose-700" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-[0_24px_48px_-36px_rgba(15,23,42,0.65)] backdrop-blur-xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Dependency Graph</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadGraphList}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Refresh List
              </button>
              {savedGraphs.length > 0 && (
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                  value={selectedGraphId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedGraphId(id);
                    if (id) {
                      void loadGraph(id);
                    } else {
                      setGraph(null);
                    }
                  }}
                >
                  <option value="">Select a saved graph</option>
                  {savedGraphs.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({new Date(g.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {graph ? (
            <>
              <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                {graph.nodes.length} nodes • {graph.edges.length} edges
              </p>
              <GraphCanvas nodes={graph.nodes} edges={graph.edges} />
            </>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-100/70 text-center text-slate-600">
              <p className="max-w-xl px-6">Upload a Terraform ZIP to render an infrastructure graph (environment, modules, resources, providers, and data sources).</p>
            </div>
          )}

          {!listLoaded && savedGraphs.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">No saved graphs found yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
