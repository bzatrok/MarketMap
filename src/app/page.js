import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-surface">
      <h1 className="text-4xl font-bold mb-4">Market Map</h1>
      <p className="text-lg text-gray-600 mb-8 text-center max-w-md">
        Discover weekly markets in the Netherlands and surrounding regions.
      </p>
      <Link
        href="/map"
        className="bg-primary text-white px-6 py-3 rounded-lg text-lg hover:opacity-90 transition-opacity"
      >
        Open Map
      </Link>
    </main>
  );
}
