'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/settings', label: 'Instellingen' },
];

export default function AdminShell({ user, children }) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-4 py-4 border-b border-gray-700">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Terug naar site
          </Link>
          <div className="text-lg font-bold mt-2">Admin</div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-gray-700 text-white font-medium'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-gray-700">
          <div className="text-xs text-gray-400 truncate">{user.email}</div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-xs text-gray-500 hover:text-white mt-1"
          >
            Uitloggen
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
    </div>
  );
}
