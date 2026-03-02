'use client';

import { useState, useEffect } from 'react';

interface TokenSummary {
  total_tokens: number;
  total_cost: number;
  formatted_cost: string;
  total_input_tokens: number;
  total_output_tokens: number;
  record_count: number;
}

interface UsageByAgent {
  agent_id: string;
  total_tokens: number;
  total_cost: number;
  formatted_cost: string;
  record_count: number;
}

interface UsageByModel {
  model: string;
  total_tokens: number;
  total_cost: number;
  formatted_cost: string;
  record_count: number;
}

interface UsageByDay {
  date: string;
  total_tokens: number;
  total_cost: number;
  formatted_cost: string;
  record_count: number;
}

interface TokenUsageData {
  summary: TokenSummary;
  by_agent: UsageByAgent[];
  by_model: UsageByModel[];
  by_day: UsageByDay[];
}

export function TokenUsageDashboard() {
  const [data, setData] = useState<TokenUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(`/api/tokens/summary?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch token usage');

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Token Usage Dashboard</h1>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total Tokens</div>
          <div className="text-2xl font-bold">{data.summary.total_tokens.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total Cost</div>
          <div className="text-2xl font-bold text-green-600">{data.summary.formatted_cost}</div>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Input Tokens</div>
          <div className="text-2xl font-bold">{data.summary.total_input_tokens.toLocaleString()}</div>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Output Tokens</div>
          <div className="text-2xl font-bold">{data.summary.total_output_tokens.toLocaleString()}</div>
        </div>
      </div>

      {/* Usage by Model */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Usage by Model</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Model</th>
                <th className="text-right py-2">Tokens</th>
                <th className="text-right py-2">Cost</th>
                <th className="text-right py-2">Records</th>
              </tr>
            </thead>
            <tbody>
              {data.by_model.map((item) => (
                <tr key={item.model} className="border-b">
                  <td className="py-2 font-mono text-sm">{item.model}</td>
                  <td className="text-right py-2">{item.total_tokens.toLocaleString()}</td>
                  <td className="text-right py-2 text-green-600">{item.formatted_cost}</td>
                  <td className="text-right py-2">{item.record_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage by Agent */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Usage by Agent</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Agent</th>
                <th className="text-right py-2">Tokens</th>
                <th className="text-right py-2">Cost</th>
                <th className="text-right py-2">Records</th>
              </tr>
            </thead>
            <tbody>
              {data.by_agent.map((item) => (
                <tr key={item.agent_id} className="border-b">
                  <td className="py-2">{item.agent_id}</td>
                  <td className="text-right py-2">{item.total_tokens.toLocaleString()}</td>
                  <td className="text-right py-2 text-green-600">{item.formatted_cost}</td>
                  <td className="text-right py-2">{item.record_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Trend */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Daily Trend (Last 30 Days)</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Date</th>
                <th className="text-right py-2">Tokens</th>
                <th className="text-right py-2">Cost</th>
                <th className="text-right py-2">Records</th>
              </tr>
            </thead>
            <tbody>
              {data.by_day.map((item) => (
                <tr key={item.date} className="border-b">
                  <td className="py-2">{item.date}</td>
                  <td className="text-right py-2">{item.total_tokens.toLocaleString()}</td>
                  <td className="text-right py-2 text-green-600">{item.formatted_cost}</td>
                  <td className="text-right py-2">{item.record_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TokenUsageDashboard;
