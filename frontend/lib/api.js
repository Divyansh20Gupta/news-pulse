// lib/api.js — small fetch wrapper around the backend API
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getTimeline: (sources) => {
    const qs = sources && sources.length ? `?source=${sources.join(",")}` : "";
    return request(`/timeline${qs}`);
  },
  getClusters: () => request("/clusters"),
  getClusterDetail: (id) => request(`/clusters/${id}`),
  triggerIngest: () => request("/ingest/trigger", { method: "POST" }),
  getIngestStatus: (jobId) => request(`/ingest/status/${jobId}`),
};
