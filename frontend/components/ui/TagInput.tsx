"use client";

import { useState } from "react";
import { X } from "lucide-react";

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  label?: string;
}

export function TagInput({ value, onChange, suggestions, label }: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
  };

  const filteredSuggestions = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-secondary tracking-[-0.01em] mb-1">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-1.5 p-2 border border-border rounded-md min-h-[42px] focus-within:border-accent-500 focus-within:ring-[3px] focus-within:ring-accent-500/15 transition-all duration-200">
        {value.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-50 text-accent-700 text-sm rounded-md border border-accent-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-accent-400 hover:text-accent-700"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={value.length === 0 ? "入力してEnterで追加" : ""}
            className="w-full border-none outline-none text-sm text-text-primary placeholder:text-text-tertiary bg-transparent py-0.5"
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-border rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(suggestion)}
                  className="block w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-tertiary transition-colors duration-150"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-text-tertiary mt-1">
        入力してEnterまたはカンマで追加。候補から選択も可能。
      </p>
    </div>
  );
}
