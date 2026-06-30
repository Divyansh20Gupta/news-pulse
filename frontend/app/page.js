"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../lib/api";
import TimelineChart from "../components/TimelineChart";
import ClusterDetail from "../components/ClusterDetail";
import SourceFilter from "../components/SourceFilter";
import RefreshButton from "../components/RefreshButton";

export default function Home() {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeSources, setActiveSources] = useState([]);
  const [allSources, setAllSources] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [clusterDetail, setClusterDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadTimeline = useCallback(async (sources) => {
    setLoading(true);
    setError(null);
    try {
      const { timeline: data } = await api.getTimeline(sources);
      setTimeline(data);

      // Derive the full source list only on first load (unfiltered)
      if (!sources || sources.length === 0) {
        const sourceSet = new Set();
        data.forEach((c) => c.sources?.forEach((s) => sourceSet.add(s)));
        const sourceList = Array.from(sourceSet).sort();
        setAllSources(sourceList);
        setActiveSources(sourceList);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  async function handleSelectCluster(id) {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const { cluster, articles } = await api.getClusterDetail(id);
      setClusterDetail({ cluster, articles });
    } catch {
      setClusterDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleSource(source) {
    const next = activeSources.includes(source)
      ? activeSources.filter((s) => s !== source)
      : [...activeSources, source];
    setActiveSources(next);
    loadTimeline(next);
  }

  const filteredTimeline = useMemo(() => timeline, [timeline]);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3 font-mono text-[11px] text-[var(--text-mid)] uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--wire-green)] pulse-dot" />
          Live wire
          <span className="text-[var(--border-strong)]">/</span>
          {timeline.length} active clusters
          <span className="text-[var(--border-strong)]">/</span>
          {allSources.length} sources
        </div>

        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              News Pulse
            </h1>
            <p className="text-sm text-[var(--text-dim)] mt-1.5">
              Stories clustered by topic, plotted on a timeline
            </p>
          </div>
          <RefreshButton onComplete={() => loadTimeline(activeSources)} />
        </div>
      </header>

      {allSources.length > 0 && (
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-mid)] mb-2">
            Filter by source
          </p>
          <SourceFilter
            allSources={allSources}
            activeSources={activeSources}
            onToggle={toggleSource}
          />
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded-md border border-red-900 bg-red-950/40 text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-dim)] text-sm">
          Loading timeline…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <TimelineChart
            timeline={filteredTimeline}
            onSelectCluster={handleSelectCluster}
            selectedId={selectedId}
          />
          <ClusterDetail
            cluster={clusterDetail?.cluster}
            articles={clusterDetail?.articles || []}
            loading={detailLoading}
            onClose={() => {
              setSelectedId(null);
              setClusterDetail(null);
            }}
          />
        </div>
      )}
    </main>
  );
}
