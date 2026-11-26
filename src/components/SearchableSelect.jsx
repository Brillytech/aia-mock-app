import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Plus, X } from 'lucide-react';

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
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const trimmed = query.trim();
  const filtered = trimmed
    ? options.filter((item) => item.toLowerCase().includes(trimmed.toLowerCase()))
    : options;

  const exactMatch =
    trimmed.length > 0 && options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  const handleSelect = (val) => {
    onChange(val);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3.5 py-2.5 min-h-[44px] rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border text-left text-xs sm:text-sm flex items-center gap-2.5 transition-all focus:outline-none ${
          isOpen
            ? 'border-orange-500 ring-2 ring-orange-500/20 bg-white dark:bg-zinc-900'
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
        }`}
      >
        {Icon && (
          <Icon
            className={`w-4 h-4 flex-shrink-0 transition-colors ${
              isOpen ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400'
            }`}
          />
        )}
        <span className="flex-1 min-w-0 truncate font-medium text-zinc-900 dark:text-zinc-100">
          {value || <span className="text-zinc-400 font-normal">{placeholder}</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-orange-500' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-view">
          <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2 bg-zinc-50/80 dark:bg-zinc-950/70">
            <Search className="w-3.5 h-3.5 text-zinc-400 ml-1 flex-shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search or add your own..."
              className="w-full bg-transparent text-xs py-1 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="px-3.5 py-1.5 bg-zinc-50/40 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800/70 flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>{filtered.length} option{filtered.length === 1 ? '' : 's'}</span>
            <span>ESC to close</span>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100/70 dark:divide-zinc-800/50">
            {filtered.length === 0 && trimmed.length <= 1 && (
              <div className="px-4 py-6 text-center text-xs text-zinc-400">
                No matches found. Type your school or course name to add it.
              </div>
            )}

            {filtered.map((item) => {
              const isSelected = item === value;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 transition-colors ${
                    isSelected
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold'
                      : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                  }`}
                >
                  <span className="truncate">{item}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              );
            })}

            {trimmed.length > 1 && !exactMatch && (
              <button
                type="button"
                onClick={() => handleSelect(trimmed)}
                className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/5 hover:bg-teal-500/10 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Use "{trimmed}"</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
