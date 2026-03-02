'use client';

import { useState, useEffect } from 'react';

interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  enabled: boolean;
  created_at: string;
}

interface Delivery {
  id: string;
  webhook_id: string;
  event_type: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  response_code: number | null;
  error: string | null;
  created_at: string;
}

const AVAILABLE_EVENTS = [
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'task.failed', label: 'Task Failed' },
  { value: 'task.status_changed', label: 'Task Status Changed' },
  { value: 'agent.status_changed', label: 'Agent Status Changed' },
  { value: 'dlq.item_added', label: 'DLQ Item Added' },
  { value: 'review.submitted', label: 'Review Submitted' },
  { value: 'job.failed', label: 'Job Failed' },
];

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    secret: '',
    events: [] as string[],
    enabled: true,
  });
  const [testing, setTesting] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [webhooksRes, deliveriesRes] = await Promise.all([
        fetch('/api/webhooks'),
        fetch('/api/webhooks/deliveries?limit=20'),
      ]);

      if (!webhooksRes.ok || !deliveriesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const webhooksData = await webhooksRes.json();
      const deliveriesData = await deliveriesRes.json();

      setWebhooks(webhooksData.webhooks || []);
      setDeliveries(deliveriesData.deliveries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      secret: '',
      events: [],
      enabled: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (webhook: Webhook) => {
    setFormData({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || '',
      events: webhook.events,
      enabled: webhook.enabled,
    });
    setEditingId(webhook.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const url = editingId ? `/api/webhooks/${editingId}` : '/api/webhooks';
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          secret: formData.secret || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save webhook');
      }

      resetForm();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });

      if (!response.ok) throw new Error('Failed to delete webhook');

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setError(null);

    try {
      const response = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Test failed');
      }

      alert(`Test successful! Response code: ${data.responseCode}`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTesting(null);
    }
  };

  const handleToggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      sent: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      retrying: 'bg-orange-100 text-orange-800',
    };

    return (
      <span className={`px-2 py-1 text-xs rounded ${styles[status] || ''}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {showForm ? 'Cancel' : 'Add Webhook'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {editingId ? 'Edit Webhook' : 'Create Webhook'}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="https://example.com/webhook"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Secret (optional, for HMAC signature)
            </label>
            <input
              type="password"
              value={formData.secret}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="Leave empty for no signature"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Events</label>
            <div className="grid grid-cols-4 gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <label
                  key={event.value}
                  className={`flex items-center gap-2 p-2 border rounded cursor-pointer ${
                    formData.events.includes(event.value) ? 'bg-blue-50 border-blue-300' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.events.includes(event.value)}
                    onChange={() => handleToggleEvent(event.value)}
                    className="rounded"
                  />
                  <span className="text-sm">{event.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="enabled" className="text-sm">Enabled</label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Webhooks List */}
      <div className="bg-white border rounded-lg">
        {webhooks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No webhooks configured. Click "Add Webhook" to create one.
          </div>
        ) : (
          <div className="divide-y">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{webhook.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">{webhook.url}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="px-2 py-0.5 text-xs bg-gray-100 rounded"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        webhook.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {webhook.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleTest(webhook.id)}
                    disabled={testing === webhook.id}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {testing === webhook.id ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleEdit(webhook)}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery History */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Recent Deliveries</h2>
        {deliveries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No deliveries yet</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 text-sm">Time</th>
                <th className="text-left p-2 text-sm">Event</th>
                <th className="text-left p-2 text-sm">Status</th>
                <th className="text-left p-2 text-sm">Response</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td className="p-2 text-sm text-gray-600">
                    {new Date(delivery.created_at).toLocaleString()}
                  </td>
                  <td className="p-2 text-sm font-mono">{delivery.event_type}</td>
                  <td className="p-2">{getStatusBadge(delivery.status)}</td>
                  <td className="p-2 text-sm">
                    {delivery.response_code && (
                      <span className={delivery.response_code < 400 ? 'text-green-600' : 'text-red-600'}>
                        {delivery.response_code}
                      </span>
                    )}
                    {delivery.error && (
                      <span className="text-red-600 text-xs">{delivery.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default WebhookManager;
