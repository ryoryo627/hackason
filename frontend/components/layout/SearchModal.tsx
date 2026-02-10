"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { RiskBadge } from "@/components/ui/Badge";
import { type Patient } from "@/lib/api";
import { usePatients } from "@/hooks/useApi";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  // SWR: cached patient list for instant search (shared cache with patients page)
  const { data: patientsData, isLoading: loading } = usePatients();
  const patients = patientsData?.patients ?? [];
  const loaded = !loading;

  // Reset query when modal closes
  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  // Auto-focus input
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced filter
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filtered = loaded
    ? (() => {
        if (!debouncedQuery.trim()) return [];
        const q = debouncedQuery.toLowerCase();
        return patients
          .filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.name_kana?.toLowerCase().includes(q) ||
              p.primary_diagnosis?.toLowerCase().includes(q) ||
              p.address?.toLowerCase().includes(q)
          )
          .slice(0, 5);
      })()
    : [];

  const handleSelect = useCallback(
    (patientId: string) => {
      onClose();
      router.push(`/patients/${patientId}`);
    },
    [onClose, router]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      {/* Search Input */}
      <div className="flex items-center gap-3 pb-3 border-b border-border -mt-2">
        <Search className="w-5 h-5 text-text-tertiary shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="患者名、フリガナ、主病名、住所で検索..."
          className="flex-1 text-sm outline-none placeholder:text-text-placeholder"
        />
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary bg-bg-tertiary rounded border border-border">
          ESC
        </kbd>
      </div>

      {/* Results */}
      <div className="mt-3 min-h-[120px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-border-strong border-t-text-secondary rounded-full animate-spin" />
          </div>
        ) : !debouncedQuery.trim() ? (
          <p className="text-sm text-text-tertiary text-center py-8">
            検索キーワードを入力してください
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-8">
            見つかりません
          </p>
        ) : (
          <div>
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
              患者
            </p>
            <ul className="space-y-1">
              {filtered.map((patient) => (
                <li key={patient.id}>
                  <button
                    onClick={() => handleSelect(patient.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover:bg-bg-tertiary transition-colors duration-150"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {patient.name}
                      </p>
                      {patient.primary_diagnosis && (
                        <p className="text-xs text-text-secondary truncate">
                          {patient.primary_diagnosis}
                        </p>
                      )}
                    </div>
                    <RiskBadge
                      level={
                        (patient.risk_level?.toUpperCase() as "HIGH" | "MEDIUM" | "LOW") ||
                        "LOW"
                      }
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 mt-2 border-t border-border flex items-center justify-between text-xs text-text-tertiary">
        <span>Esc で閉じる</span>
        <span className="hidden sm:inline">
          <kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border text-[10px]">
            ⌘K
          </kbd>{" "}
          で検索
        </span>
      </div>
    </Modal>
  );
}
