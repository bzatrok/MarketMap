import { readFileSync } from 'fs';
import path from 'path';

export const metadata = {
  title: 'Data Sources - Weekly Markets in the Netherlands',
  description: 'Sources and data completeness for Dutch weekly market listings.',
};

function loadMarketData() {
  const filePath = path.join(process.cwd(), 'static', 'weekly_markets_netherlands.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export default function SourcesPage() {
  const data = loadMarketData();
  const { meta, markets } = data;

  // Build per-province stats
  const byProvince = {};
  markets.forEach((m) => {
    if (!byProvince[m.province]) {
      byProvince[m.province] = { count: 0, sources: new Set() };
    }
    byProvince[m.province].count++;
    if (m.source_url) byProvince[m.province].sources.add(m.source_url);
  });

  const allProvinces = [
    ...meta.provinces_complete.map((p) => ({ name: p, status: 'complete' })),
    ...meta.provinces_todo.map((p) => ({ name: p, status: 'todo' })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-2">Data Sources</h1>
      <p className="text-sm text-gray-500 mb-6">
        Last compiled: {meta.compilation_date} — {meta.total_markets} markets total
      </p>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Sources</h2>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>
            Primary:{' '}
            <a
              href="https://evenementenlijst.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              evenementenlijst.nl
            </a>
          </li>
          {meta.secondary_sources.map((s) => (
            <li key={s}>Secondary: {s}</li>
          ))}
        </ul>
      </div>

      <h2 className="text-lg font-semibold mb-3">Per Province</h2>
      <div className="space-y-3">
        {allProvinces.map(({ name, status }) => {
          const stats = byProvince[name];
          return (
            <div key={name} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-gray-900">{name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    status === 'complete'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {status === 'complete' ? 'Complete' : 'In progress'}
                </span>
              </div>
              {stats ? (
                <div className="text-sm text-gray-500">
                  {stats.count} markets from {stats.sources.size} sources
                </div>
              ) : (
                <div className="text-sm text-gray-400">No data yet</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
