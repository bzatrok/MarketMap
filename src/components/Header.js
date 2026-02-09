import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-50">
      <Link href="/" className="text-xl font-bold text-primary">
        Market Map
      </Link>
      <nav className="flex gap-4 text-sm">
        <Link href="/markets" className="text-gray-600 hover:text-primary">
          Markets
        </Link>
      </nav>
    </header>
  );
}
