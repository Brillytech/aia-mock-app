import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Plus } from 'lucide-react';

export default function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  icon: Icon
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((item) =>
    item.toLowerCase().includes(query.trim().toLowerCase())
  );

  const handleSelect = (val) => {
    onChange(val);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-semibold mb-1.5 text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-left text-xs sm:text-sm flex items-center justify-between focus:outline-none focus:border-orange-600 transition-colors"
      >
        {Icon && (
          <Icon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        )}
        <span className="truncate font-medium">
          {value || <span className="text-zinc-400">{placeholder}</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-view">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2 bg-zinc-50/70 dark:bg-zinc-950/60">
            <Search className="w-3.5 h-3.5 text-zinc-400 ml-2 flex-shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search or add custom..."
              className="w-full bg-transparent text-xs py-1 pr-2 focus:outline-none"
            />
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-zinc-100/70 dark:divide-zinc-800/50">
            {filtered.map((item) => {
              const isSelected = item === value;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                  }`}
                >
                  <span className="truncate pr-2">{item}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              );
            })}

            {query.trim().length > 1 &&
              !options.some((o) => o.toLowerCase() === query.trim().toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => handleSelect(query.trim())}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/5 hover:bg-teal-500/10 flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Use "{query.trim()}"</span>
                </button>
              )}
          </div>
        </div>
      )}
    </div>
  );
}