"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { GraphCanvas } from "@/components/GraphCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { GraphDto, WorkspaceDto } from "common/dto";

const WORKSPACE_STORAGE_KEY = "drawtform:selected-workspace";
const THEME_STORAGE_KEY = "drawtform:theme";

type ThemeMode = "light" | "dark" | "system";

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyTheme(mode: ThemeMode) {
  const html = document.documentElement;
  html.setAttribute("data-theme", resolveTheme(mode));
}

export default function Home() {
  const [graph, setGraph] = useState<GraphDto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [graphName, setGraphName] = useState("main");

  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [savedGraphs, setSavedGraphs] = useState<{ id: string; name: string; createdAt: string }[]>([]);
  const [selectedGraphId, setSelectedGraphId] = useState("");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [graphsCollapsed, setGraphsCollapsed] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);

  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId]
  );

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null) ?? "system";
    setThemeMode(saved);
    applyTheme(saved);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      const current = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null) ?? "system";
      if (current === "system") applyTheme("system");
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const changeTheme = useCallback((mode: ThemeMode) => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    setThemeMode(mode);
    applyTheme(mode);
  }, []);

  const loadGraph = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/graph/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load graph");
      setGraph(data.graph);
      setSelectedGraphId(data.graph?.id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load graph");
    }
  }, []);

  const loadGraphList = useCallback(
    async (workspaceId: string) => {
      setError(null);
      if (!workspaceId) {
        setSavedGraphs([]);
        setGraph(null);
        setSelectedGraphId("");
        return;
      }

      try {
        const res = await fetch(`/api/v1/graphs?workspaceId=${encodeURIComponent(workspaceId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to list graphs");

        const graphs = (data.graphs ?? []) as { id: string; name: string; createdAt: string }[];
        setSavedGraphs(graphs);

        if (graphs.length === 0) {
          setGraph(null);
          setSelectedGraphId("");
          return;
        }

        const activeGraphId = selectedGraphId && graphs.some((g) => g.id === selectedGraphId)
          ? selectedGraphId
          : graphs[0].id;

        await loadGraph(activeGraphId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to list graphs");
      }
    },
    [loadGraph, selectedGraphId]
  );

  const selectWorkspace = useCallback(
    async (workspaceId: string) => {
      setSelectedWorkspaceId(workspaceId);
      localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
      setGraph(null);
      setSelectedGraphId("");
      await loadGraphList(workspaceId);
    },
    [loadGraphList]
  );

  const loadWorkspaces = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/v1/workspaces");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to list workspaces");

      const fetched = (data.workspaces ?? []) as WorkspaceDto[];
      setWorkspaces(fetched);

      if (fetched.length === 0) {
        setShowCreateWorkspace(true);
        setSelectedWorkspaceId("");
        setSavedGraphs([]);
        setGraph(null);
        return;
      }

      const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      const targetId = stored && fetched.some((w) => w.id === stored) ? stored : fetched[0].id;
      await selectWorkspace(targetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list workspaces");
    }
  }, [selectWorkspace]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const createWorkspace = useCallback(async () => {
    const trimmed = workspaceName.trim();
    if (!trimmed) {
      setError("Workspace name is required.");
      return;
    }

    setCreatingWorkspace(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create workspace");

      const created = data.workspace as WorkspaceDto;
      setWorkspaces((prev) => [created, ...prev]);
      setWorkspaceName("");
      setShowCreateWorkspace(false);
      await selectWorkspace(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create workspace");
    } finally {
      setCreatingWorkspace(false);
    }
  }, [selectWorkspace, workspaceName]);

  const deleteCurrentWorkspace = useCallback(async () => {
    if (!selectedWorkspaceId || !selectedWorkspace) return;

    const confirmed = window.confirm(
      `Delete workspace \"${selectedWorkspace.name}\"? This will also delete all graphs in it.`
    );
    if (!confirmed) return;

    setDeletingWorkspace(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/workspaces/${selectedWorkspaceId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete workspace");

      const remaining = workspaces.filter((w) => w.id !== selectedWorkspaceId);
      setWorkspaces(remaining);

      if (remaining.length === 0) {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);
        setSelectedWorkspaceId("");
        setSavedGraphs([]);
        setGraph(null);
        setSelectedGraphId("");
        setShowCreateWorkspace(true);
      } else {
        await selectWorkspace(remaining[0].id);
      }

      setNotice("Workspace deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete workspace");
    } finally {
      setDeletingWorkspace(false);
    }
  }, [selectedWorkspaceId, selectedWorkspace, workspaces, selectWorkspace]);

  const handleUpload = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setNotice(null);

      if (!selectedWorkspaceId) {
        setError("Please create or select a workspace first.");
        return;
      }

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
        fd.append("workspaceId", selectedWorkspaceId);

        const res = await fetch("/api/v1/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        setNotice(data.message || "Upload completed.");
        await loadGraphList(selectedWorkspaceId);
        await loadGraph(data.graphId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [graphName, loadGraph, loadGraphList, selectedWorkspaceId]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.12),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex w-full items-center justify-between gap-3 px-3 py-2">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Terraform Visualizer</p>
            <h1 className="text-base font-semibold tracking-tight">DrawTform</h1>

            <div className="relative">
              <Button variant="outline" className="normal-case" onClick={() => setWorkspaceDropdownOpen((v) => !v)}>
                {selectedWorkspace?.name ?? "Workspace"} ▾
              </Button>
              {workspaceDropdownOpen && (
                <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[300px] rounded-xl border border-slate-200 bg-white/95 p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900/95">
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    {workspaces.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          void selectWorkspace(w.id);
                          setWorkspaceDropdownOpen(false);
                        }}
                        className={[
                          "w-full border-b border-slate-200 px-2.5 py-2 text-left text-sm last:border-b-0 dark:border-slate-800",
                          selectedWorkspaceId === w.id
                            ? "bg-cyan-50 text-slate-900 dark:bg-cyan-950/40 dark:text-slate-100"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800",
                        ].join(" ")}
                      >
                        {w.name}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowCreateWorkspace(true);
                        setWorkspaceDropdownOpen(false);
                      }}
                    >
                      Create New
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        void deleteCurrentWorkspace();
                        setWorkspaceDropdownOpen(false);
                      }}
                      disabled={!selectedWorkspaceId || deletingWorkspace}
                    >
                      Delete Current
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Theme</label>
            <Select
              value={themeMode}
              onChange={(e) => changeTheme(e.target.value as ThemeMode)}
              className="text-xs"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </Select>
          </div>
        </div>
      </header>

      <main className="flex w-full gap-0">
        <aside
          className={[
            "border-r border-slate-200 bg-white/70 p-2 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/40",
            sidebarCollapsed ? "w-[60px]" : "w-[300px]",
          ].join(" ")}
        >
          <div className="mb-2 flex items-center justify-between">
            {!sidebarCollapsed && <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Explorer</h2>}
            <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => setSidebarCollapsed((v) => !v)}>
              {sidebarCollapsed ? ">" : "<"}
            </Button>
          </div>

          {!sidebarCollapsed && (
            <div className="space-y-2">
              <Button variant="outline" className="flex w-full justify-between normal-case" onClick={() => setGraphsCollapsed((v) => !v)}>
                <span className="text-sm font-medium">Saved Graphs</span>
                <span className="text-sm text-slate-400">{graphsCollapsed ? "+" : "-"}</span>
              </Button>

              {!graphsCollapsed && (
                <div className="max-h-[calc(100vh-180px)] space-y-1 overflow-y-auto">
                  {savedGraphs.length === 0 && (
                    <p className="border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      No graphs in this workspace.
                    </p>
                  )}
                  {savedGraphs.map((g) => {
                    const active = selectedGraphId === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => void loadGraph(g.id)}
                        className={[
                          "w-full rounded-lg border px-3 py-2 text-left transition",
                          active
                            ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30"
                            : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800",
                        ].join(" ")}
                      >
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{g.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(g.createdAt).toLocaleString()}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </aside>

        <section className="min-w-0 flex-1 space-y-0">
          <section className="m-2 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
            <form onSubmit={handleUpload} className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Graph Name</span>
                <Input
                  type="text"
                  name="name"
                  value={graphName}
                  onChange={(e) => setGraphName(e.target.value)}
                  placeholder="prod / staging / main"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Terraform Zip</span>
                <Input type="file" name="file" accept=".zip" className="file:mr-3 file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 dark:file:bg-slate-700 dark:file:text-slate-100" />
              </label>

              <Button type="submit" disabled={uploading || !selectedWorkspaceId} className="px-4 py-2.5 text-sm normal-case">
                {uploading ? "Building..." : "Upload"}
              </Button>
            </form>

            {(notice || error) && (
              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                {notice && <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
                {error && (
                  <p className="text-sm text-rose-700 dark:text-rose-400" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="m-2 mt-0 rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Dependency Graph</h2>
              {graph && <p className="text-xs text-slate-500 dark:text-slate-400">{graph.nodes.length} nodes • {graph.edges.length} edges</p>}
            </div>

            {graph ? (
              <GraphCanvas nodes={graph.nodes} edges={graph.edges} />
            ) : (
              <div className="flex min-h-[540px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                <p className="max-w-xl px-6">Select a graph from the sidebar, or upload a new Terraform ZIP.</p>
              </div>
            )}
          </section>
        </section>
      </main>

      {showCreateWorkspace && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create Workspace</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Workspaces separate your saved Terraform graphs.</p>

            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Workspace name</label>
              <Input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Platform Team"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              {workspaces.length > 0 && (
                <Button variant="outline" onClick={() => setShowCreateWorkspace(false)}>
                  Cancel
                </Button>
              )}
              <Button onClick={() => void createWorkspace()} disabled={creatingWorkspace}>
                {creatingWorkspace ? "Creating..." : "Create Workspace"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
