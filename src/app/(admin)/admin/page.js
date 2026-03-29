import { getDb } from '@/lib/db';
import { getMarkets } from '@/lib/markets';

export default function AdminDashboard() {
  const db = getDb();
  const { markets } = getMarkets();

  const descCount = db.prepare('SELECT COUNT(*) as count FROM descriptions').get().count;
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const lastGenRow = db.prepare('SELECT generatedAt FROM descriptions ORDER BY generatedAt DESC LIMIT 1').get();

  const stats = [
    { label: 'Markten', value: markets.length },
    { label: 'Beschrijvingen', value: `${descCount} / ${markets.length}` },
    { label: 'Gebruikers', value: userCount },
    {
      label: 'Laatste generatie',
      value: lastGenRow ? new Date(lastGenRow.generatedAt).toLocaleDateString('nl-NL') : 'Nog niet',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
