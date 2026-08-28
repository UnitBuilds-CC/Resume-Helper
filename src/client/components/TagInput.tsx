import { useState, useRef, useEffect } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

export default function TagInput({ tags, onChange, suggestions = [] }: TagInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  );

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 p-2.5 input min-h-[44px]">
        {tags.map(tag => (
          <span
            key={tag}
            className="tag gap-1"
          >
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="text-teal-600/60 hover:text-mint-600 text-xs">×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={tags.length ? '' : 'Type a skill and press Enter...'}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-sapphire-800 outline-none placeholder:text-sapphire-400"
        />
      </div>
      {showSuggestions && input && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-cream-300/50 rounded-lg max-h-40 overflow-auto shadow-lg shadow-earth-950/50">
          {filtered.map(s => (
            <li
              key={s}
              onMouseDown={() => addTag(s)}
              className="px-3 py-2 text-sm text-sapphire-600 hover:bg-cream-100/50 hover:text-sapphire-800 cursor-pointer transition-colors"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
