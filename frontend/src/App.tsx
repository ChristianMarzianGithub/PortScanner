import React, { useEffect, useMemo, useState } from 'react';
import type { PortResult, ScanResponse } from './types';

const ALLOWED_PORTS: number[] = [
  21, 22, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 8080,
];
const PRESET_TARGETS = ['google.com', 'cloudflare.com', 'github.com'];
const HISTORY_KEY = 'portscanner-history';
const THEME_KEY = 'portscanner-theme';

interface HistoryItem extends ScanResponse {}

function loadHistory(): HistoryItem[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as HistoryItem[];
  } catch (err) {
    console.error('Failed to load history', err);
    return [];
  }
}

function saveHistory(entries: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 5)));
}

function statusColor(status: PortResult['status']) {
  switch (status) {
    case 'open':
      return 'text-green-600 dark:text-green-400';
    case 'closed':
      return 'text-red-600 dark:text-red-400';
    case 'filtered':
    default:
      return 'text-yellow-600 dark:text-yellow-300';
  }
}

const App: React.FC = () => {
  const [target, setTarget] = useState('');
  const [selectedPorts, setSelectedPorts] = useState<number[]>([80, 443]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ScanResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const apiBase = useMemo(() => import.meta.env.VITE_API_URL || 'http://localhost:3001', []);

  const togglePort = (port: number) => {
    setSelectedPorts((prev) => {
      if (prev.includes(port)) {
        return prev.filter((p) => p !== port);
      }
      return [...prev, port];
    });
  };

  const handleScan = async () => {
    setError(null);
    setResults(null);
    if (!target.trim()) {
      setError('Please enter a domain or public IP.');
      return;
    }
    if (selectedPorts.length === 0) {
      setError('Select at least one port to scan.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim(), ports: selectedPorts }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unexpected error');
      }
      setResults(data);
      const updatedHistory = [data as ScanResponse, ...history].slice(0, 5);
      setHistory(updatedHistory);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (host: string) => {
    setTarget(host);
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Light & Safe Port Scanner</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Basic TCP connectivity checker with strict safety controls.
            </p>
          </div>
          <button
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <section className="bg-white dark:bg-gray-950 shadow-sm rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-4 md:space-y-0">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Target (public domain or IP)</label>
              <input
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="example.com"
              />
            </div>
            <button
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleScan}
              disabled={loading}
            >
              {loading ? 'Scanning...' : 'Run Port Scan'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="font-medium">Common ports:</span>
            {ALLOWED_PORTS.map((port) => (
              <label key={port} className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                <input
                  type="checkbox"
                  checked={selectedPorts.includes(port)}
                  onChange={() => togglePort(port)}
                  className="accent-blue-600"
                />
                <span>{port}</span>
              </label>
            ))}
            <span className="ml-auto text-xs text-gray-600 dark:text-gray-400">
              Up to 20 ports per scan.
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Test targets:</span>
            {PRESET_TARGETS.map((item) => (
              <button
                key={item}
                onClick={() => selectPreset(item)}
                className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                {item}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 text-red-700 border border-red-200 px-3 py-2 text-sm">
              {error}
            </div>
          )}
        </section>

        {results && (
          <section className="bg-white dark:bg-gray-950 shadow-sm rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Latest scan</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Target: {results.target} ({results.ip}) — {new Date(results.timestamp).toLocaleString()}
                </p>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 dark:text-gray-400">
                    <th className="py-2">Port</th>
                    <th className="py-2">Protocol</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Latency (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((result) => (
                    <tr key={result.port} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-2 font-semibold">{result.port}</td>
                      <td className="py-2">TCP</td>
                      <td className={`py-2 font-medium ${statusColor(result.status)}`}>
                        {result.status}
                      </td>
                      <td className="py-2">{result.latency_ms ? result.latency_ms : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="bg-white dark:bg-gray-950 shadow-sm rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-3">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent scans</h3>
            <button
              className="text-sm text-blue-600 dark:text-blue-400"
              onClick={() => {
                setHistory([]);
                saveHistory([]);
              }}
            >
              Clear history
            </button>
          </header>
          {history.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No scans yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((item) => (
                <li
                  key={`${item.target}-${item.timestamp}`}
                  className="flex justify-between items-center p-2 rounded bg-gray-100 dark:bg-gray-800"
                >
                  <div>
                    <p className="font-medium">{item.target}</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {new Date(item.timestamp).toLocaleString()} • Ports: {item.results.map((r) => r.port).join(', ')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">IP: {item.ip}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-900 dark:text-blue-100">
          <p className="font-semibold">Safety notice</p>
          <p>
            This tool performs only safe TCP connect() checks against a limited set of common service ports.
            Private, localhost, and internal networks are blocked, and scans are rate-limited.
          </p>
        </section>
      </main>
    </div>
  );
};

export default App;
