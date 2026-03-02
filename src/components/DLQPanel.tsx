'use client';

import { useState, useEffect } from 'react';

interface DLQEntry {
  id: string;
  job_name: string;
  original_job_id: string;
  payload: any;
  failure_reason: string;
  retry_count: number;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export function DLQPanel() {
  const [entries, setEntries] = useState<DLQEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('unresolved', showResolved ? 'false' : 'true');

      const response = await fetch(`/api/dlq?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch DLQ entries');

      const data = await response.json();
      setEntries(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [showResolved]);

  const handleResolve = async (id: string) => {
    try {
      const response = await fetch('/api/dlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', id, resolvedBy: 'ui' }),
      });

      if (!response.ok) throw new Error('Failed to resolve');
      await fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const response = await fetch('/api/dlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', id }),
      });

      if (!response.ok) throw new Error('Failed to retry');
      await fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Dead Letter Queue</h2>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded"
            />
            Show resolved
          </label>
          <button
            onClick={fetchEntries}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="bg-gray-50 border rounded p-8 text-center text-gray-500">
          No failed jobs in DLQ
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-mono text-sm font-medium">{entry.job_name}</h3>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
                {entry.resolved_at ? (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                    Resolved by {entry.resolved_by}
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                    Retry #{entry.retry_count}
                  </span>
                )}
              </div>

              <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
                <p className="text-sm text-red-700 font-mono">{entry.failure_reason}</p>
              </div>

              {!entry.resolved_at && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRetry(entry.id)}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => handleResolve(entry.id)}
                    className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >
                    Mark Resolved
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DLQPanel;
