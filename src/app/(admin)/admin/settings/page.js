'use client';

import { useState, useEffect } from 'react';

const SETTING_FIELDS = [
  { key: 'siteName', label: 'Sitenaam', type: 'text' },
  { key: 'seoDefaultDescription', label: 'SEO standaard beschrijving', type: 'textarea' },
  { key: 'openaiModel', label: 'OpenAI model', type: 'text' },
  { key: 'analyticsEnabled', label: 'Analytics ingeschakeld', type: 'toggle' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
  }

  if (loading) return <div className="text-sm text-gray-500">Laden...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Instellingen</h1>

      <form onSubmit={handleSave} className="max-w-xl space-y-6">
        {SETTING_FIELDS.map(({ key, label, type }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            {type === 'textarea' ? (
              <textarea
                value={settings[key] || ''}
                onChange={(e) => updateSetting(key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
              />
            ) : type === 'toggle' ? (
              <button
                type="button"
                onClick={() => updateSetting(key, settings[key] === 'true' ? 'false' : 'true')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings[key] === 'true' ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings[key] === 'true' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            ) : (
              <input
                type="text"
                value={settings[key] || ''}
                onChange={(e) => updateSetting(key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
          {saved && <span className="text-sm text-green-600">Opgeslagen</span>}
        </div>
      </form>
    </div>
  );
}
