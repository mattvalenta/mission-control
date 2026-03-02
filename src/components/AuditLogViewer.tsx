'use client';

import { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  action: string;
  actor: string;
  actor_id: string | null;
  actor_instance: string | null;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditStats {
  total_events: string;
  unique_actors: string;
  top_actions: Array<{ action: string; count: string }>;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStats, setShowStats] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      if (actorFilter) params.append('actor', actorFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (showStats) params.append('stats', 'true');

      const response = await fetch(`/api/audit?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');

      const data = await response.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
      // Tasks
      task_created: 'bg-blue-100 text-blue-800',
      task_completed: 'bg-green-100 text-green-800',
      task_dispatched: 'bg-purple-100 text-purple-800',
      task_deleted: 'bg-red-100 text-red-800',
      // Agents
      agent_created: 'bg-blue-100 text-blue-800',
      agent_status_changed: 'bg-yellow-100 text-yellow-800',
      // Reviews
      review_submitted: 'bg-indigo-100 text-indigo-800',
      review_approved: 'bg-green-100 text-green-800',
      review_rejected: 'bg-red-100 text-red-800',
      // System
      job_completed: 'bg-gray-100 text-gray-800',
      job_failed: 'bg-red-100 text-red-800',
      dlq_item_added: 'bg-orange-100 text-orange-800',
      // Security
      login: 'bg-green-100 text-green-800',
      login_failed: 'bg-red-100 text-red-800',
      settings_changed: 'bg-yellow-100 text-yellow-800',
    };

    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const renderDetail = (detail: Record<string, any> | null) => {
    if (!detail) return <span className="text-gray-400">—</span>;

    return (
      <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-w-md">
        {JSON.stringify(detail, null, 2)}
      </pre>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Total Events (7 days)</div>
            <div className="text-2xl font-bold">{stats.total_events}</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Unique Actors</div>
            <div className="text-2xl font-bold">{stats.unique_actors}</div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-500">Top Actions</div>
            <div className="text-sm mt-1">
              {stats.top_actions?.slice(0, 3).map((a, i) => (
                <div key={i}>{a.action}: {a.count}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-medium mb-3">Filters</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All actions</option>
              <option value="task_created">Task Created</option>
              <option value="task_completed">Task Completed</option>
              <option value="task_dispatched">Task Dispatched</option>
              <option value="agent_status_changed">Agent Status</option>
              <option value="review_submitted">Review Submitted</option>
              <option value="job_completed">Job Completed</option>
              <option value="job_failed">Job Failed</option>
              <option value="dlq_item_added">DLQ Added</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Actor</label>
            <input
              type="text"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder="e.g., skippy, dev-manager"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Apply Filters
          </button>
          <button
            onClick={() => {
              setActionFilter('');
              setActorFilter('');
              setStartDate('');
              setEndDate('');
            }}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Time</th>
              <th className="text-left p-3 text-sm font-medium">Action</th>
              <th className="text-left p-3 text-sm font-medium">Actor</th>
              <th className="text-left p-3 text-sm font-medium">Target</th>
              <th className="text-left p-3 text-sm font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-3 text-sm text-gray-600">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 text-xs rounded ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-sm">
                    <div>{log.actor}</div>
                    {log.actor_instance && (
                      <div className="text-xs text-gray-400">{log.actor_instance}</div>
                    )}
                  </td>
                  <td className="p-3 text-sm">
                    {log.target_type && (
                      <div>
                        <span className="text-gray-500">{log.target_type}:</span>{' '}
                        {log.target_id}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {renderDetail(log.detail)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Count */}
      <div className="text-sm text-gray-500 text-center">
        Showing {logs.length} logs
      </div>
    </div>
  );
}

export default AuditLogViewer;
