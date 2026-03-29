'use client';

import { useState, useEffect, useCallback } from 'react';

export default function ContentPage() {
  const [markets, setMarkets] = useState([]);
  const [total, setTotal] = useState(0);
  const [withDescriptions, setWithDescriptions] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all', 'missing', 'done'
  const [editing, setEditing] = useState(null); // slug being edited
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null); // slug being generated
  const [error, setError] = useState(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/descriptions');
    const data = await res.json();
    setMarkets(data.markets || []);
    setTotal(data.total || 0);
    setWithDescriptions(data.withDescriptions || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  async function handleRegenerate(slug) {
    setGenerating(slug);
    setError(null);
    const res = await fetch(`/api/admin/descriptions/${slug}`, { method: 'POST' });
    if (res.ok) {
      await fetchMarkets();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || `Genereren mislukt (${res.status})`);
    }
    setGenerating(null);
  }

  async function handleEdit(slug) {
    const res = await fetch(`/api/admin/descriptions/${slug}`);
    if (res.ok) {
      const data = await res.json();
      setEditing(slug);
      setEditContent(data.content);
    }
  }

  async function handleSave() {
    setError(null);
    const res = await fetch(`/api/admin/descriptions/${editing}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    });
    if (res.ok) {
      setEditing(null);
      setEditContent('');
      fetchMarkets();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || `Opslaan mislukt (${res.status})`);
    }
  }

  const filtered = markets.filter((m) => {
    if (filter === 'missing') return !m.hasDescription;
    if (filter === 'done') return m.hasDescription;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Content beheer</h1>
        <div className="text-sm text-gray-500">
          {withDescriptions} / {total} beschrijvingen
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {['all', 'missing', 'done'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              filter === f
                ? 'bg-blue-50 text-blue-700 border-blue-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {f === 'all' ? 'Alle' : f === 'missing' ? 'Zonder beschrijving' : 'Met beschrijving'}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      {editing && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-sm">{editing}</h3>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:text-gray-700">
                Annuleren
              </button>
              <button onClick={handleSave} className="text-xs text-white bg-blue-600 px-3 py-1 rounded-md hover:bg-blue-700">
                Opslaan
              </button>
            </div>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Laden...</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Markt</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Provincie</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((m) => (
                <tr key={m.slug} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{m.name}</td>
                  <td className="px-4 py-2 text-gray-500">{m.province}</td>
                  <td className="px-4 py-2">
                    {m.hasDescription ? (
                      <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Beschreven</span>
                    ) : (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Ontbreekt</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-2 justify-end">
                      {m.hasDescription && (
                        <button onClick={() => handleEdit(m.slug)} className="text-xs text-blue-600 hover:underline">
                          Bewerken
                        </button>
                      )}
                      <button
                        onClick={() => handleRegenerate(m.slug)}
                        disabled={generating === m.slug}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                      >
                        {generating === m.slug ? 'Genereren...' : m.hasDescription ? 'Hergenereren' : 'Genereren'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
