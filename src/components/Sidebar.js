'use client';

export default function Sidebar({ children, open, onToggle }) {

  return (
    <>
      {/* Toggle button — only visible when sidebar is closed */}
      {!open && (
        <button
          onClick={() => onToggle(true)}
          className="absolute top-2 left-2 z-20 bg-white border border-gray-300 rounded-md p-2 shadow-sm hover:bg-gray-50 transition-colors"
          aria-label="Open sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* Sidebar panel */}
      <div
        className={`absolute top-0 left-0 h-full bg-white border-r border-gray-200 z-10 transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '380px' }}
      >
        <div className="h-full overflow-y-auto px-4 pb-4">
          {/* Header row: back arrow + first child (SearchInput) */}
          <div className="flex items-center gap-2 pt-3 pb-3 sticky top-0 bg-white z-10">
            <button
              onClick={() => onToggle(false)}
              className="flex-shrink-0 bg-white border border-gray-300 rounded-md p-2 hover:bg-gray-50 transition-colors"
              aria-label="Close sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">{children[0]}</div>
          </div>
          {/* Remaining children (filters, market list) */}
          <div className="space-y-4">
            {children.slice(1)}
          </div>
        </div>
      </div>
    </>
  );
}
