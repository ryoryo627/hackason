"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Search,
} from "lucide-react";
import { patientsApi, setupApi, type Patient } from "@/lib/api";

type Step = "select" | "progress" | "result";

interface SlackUser {
  id: string;
  name: string;
  email: string;
  display_name: string;
}

interface BulkAssignResult {
  patient_id: string;
  patient_name: string;
  success: boolean;
  invited?: number;
  note?: string;
  error?: string;
}

interface BulkAssignMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPatients: Patient[];
  onComplete: () => void;
}

export function BulkAssignMembersModal({
  isOpen,
  onClose,
  selectedPatients,
  onComplete,
}: BulkAssignMembersModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState("");

  // Progress state
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ total: 0, completed: 0 });
  const [results, setResults] = useState<BulkAssignResult[]>([]);
  const [taskStatus, setTaskStatus] = useState<string>("processing");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Patients without Slack channel
  const patientsWithoutChannel = selectedPatients.filter((p) => !p.slack_channel_id);

  // Load Slack users on open
  useEffect(() => {
    if (isOpen && step === "select") {
      setLoadingUsers(true);
      setupApi
        .listSlackUsers()
        .then((data) => setSlackUsers(data.users))
        .catch(() => setSlackUsers([]))
        .finally(() => setLoadingUsers(false));
    }
  }, [isOpen, step]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const filteredUsers = slackUsers.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.display_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleExecute = async () => {
    setStep("progress");
    try {
      const res = await patientsApi.bulkAssignMembers({
        patient_ids: selectedPatients.map((p) => p.id),
        user_ids: Array.from(selectedUserIds),
      });
      setTaskId(res.task_id);
      setProgress({ total: res.total_patients, completed: 0 });

      // Start polling
      pollingRef.current = setInterval(async () => {
        try {
          const status = await patientsApi.getBulkAssignProgress(res.task_id);
          setProgress({ total: status.total, completed: status.completed });
          setResults(status.results);
          setTaskStatus(status.status);

          if (status.status === "completed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setStep("result");
          }
        } catch {
          // Ignore polling errors
        }
      }, 2000);
    } catch (err) {
      setResults([
        {
          patient_id: "",
          patient_name: "",
          success: false,
          error: err instanceof Error ? err.message : "実行に失敗しました",
        },
      ]);
      setTaskStatus("completed");
      setStep("result");
    }
  };

  const handleClose = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setStep("select");
    setSelectedUserIds(new Set());
    setUserSearch("");
    setTaskId(null);
    setResults([]);
    setTaskStatus("processing");
    onClose();
  };

  const handleDone = () => {
    handleClose();
    onComplete();
  };

  const successCount = results.filter((r) => r.success && (r.invited ?? 0) > 0).length;
  const skipCount = results.filter((r) => r.success && (r.invited ?? 0) === 0).length;
  const errorCount = results.filter((r) => !r.success).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={step === "progress" ? () => {} : handleClose}
      title="メンバー一括割当"
      size="lg"
    >
      {/* Step 1: Select members */}
      {step === "select" && (
        <div>
          {/* Selected patients summary */}
          <div className="mb-4">
            <p className="text-sm text-text-secondary mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              <strong>{selectedPatients.length}件</strong>の患者に担当メンバーを割り当て
            </p>
            <div className="bg-bg-secondary rounded-lg p-3 max-h-24 overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {selectedPatients.slice(0, 8).map((p) => (
                  <span
                    key={p.id}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      p.slack_channel_id
                        ? "bg-accent-100 text-accent-700"
                        : "bg-warning-light text-warning"
                    }`}
                  >
                    {p.name}
                    {!p.slack_channel_id && " (CH未作成)"}
                  </span>
                ))}
                {selectedPatients.length > 8 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-hover text-text-secondary">
                    +{selectedPatients.length - 8}件
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Warning for patients without Slack channel */}
          {patientsWithoutChannel.length > 0 && (
            <div className="mb-4 p-3 bg-warning-light border border-warning/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-sm text-warning">
                  {patientsWithoutChannel.length}件の患者はSlackチャンネルが未作成のためスキップされます
                </p>
              </div>
            </div>
          )}

          {/* Slack user list */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              割り当てるメンバーを選択
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="メンバーを検索..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
                  <span className="ml-2 text-sm text-text-secondary">読み込み中...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-6 text-center text-sm text-text-secondary">
                  {userSearch ? "検索結果がありません" : "Slackユーザーが見つかりません"}
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-bg-secondary cursor-pointer border-b border-border-light last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="h-4 w-4 rounded border-border-strong text-accent-600 focus:ring-accent-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {user.name}
                      </p>
                      {user.display_name && user.display_name !== user.name && (
                        <p className="text-xs text-text-secondary truncate">{user.display_name}</p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
            {selectedUserIds.size > 0 && (
              <p className="text-sm text-accent-600 mt-1">
                {selectedUserIds.size}名選択中
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={handleClose}>
              キャンセル
            </Button>
            <Button
              disabled={selectedUserIds.size === 0}
              onClick={handleExecute}
            >
              <Users className="w-4 h-4 mr-2" />
              割り当て実行
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Progress */}
      {step === "progress" && (
        <div>
          <div className="text-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-accent-500 mx-auto mb-2" />
            <p className="text-sm text-text-secondary">
              処理中... ({progress.completed}/{progress.total})
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-bg-hover rounded-full h-2 mb-4">
            <div
              className="bg-accent-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: progress.total > 0 ? `${(progress.completed / progress.total) * 100}%` : "0%",
              }}
            />
          </div>

          {/* Per-patient status */}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm py-1 px-2 rounded"
              >
                {r.success ? (
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-danger flex-shrink-0" />
                )}
                <span className="text-text-secondary truncate">{r.patient_name}</span>
                {r.note && (
                  <span className="text-xs text-text-tertiary ml-auto flex-shrink-0">{r.note}</span>
                )}
                {r.error && (
                  <span className="text-xs text-danger ml-auto flex-shrink-0">{r.error}</span>
                )}
              </div>
            ))}
            {/* Pending items */}
            {selectedPatients.slice(results.length).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 text-sm py-1 px-2 rounded text-text-tertiary"
              >
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span className="truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === "result" && (
        <div className="text-center py-4">
          <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">完了</h3>

          <div className="flex justify-center gap-4 mb-4">
            {successCount > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{successCount}</p>
                <p className="text-xs text-text-secondary">成功</p>
              </div>
            )}
            {skipCount > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">{skipCount}</p>
                <p className="text-xs text-text-secondary">スキップ</p>
              </div>
            )}
            {errorCount > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-danger">{errorCount}</p>
                <p className="text-xs text-text-secondary">エラー</p>
              </div>
            )}
          </div>

          {/* Error details */}
          {results.some((r) => !r.success || r.note) && (
            <div className="text-left max-h-32 overflow-y-auto bg-bg-secondary rounded-lg p-3 mb-4">
              {results
                .filter((r) => !r.success || r.note)
                .map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                    {r.success ? (
                      <span className="text-warning text-xs">&#9679;</span>
                    ) : (
                      <span className="text-danger text-xs">&#9679;</span>
                    )}
                    <span className="text-text-secondary">{r.patient_name}</span>
                    <span className="text-xs text-text-secondary ml-auto">
                      {r.error || r.note}
                    </span>
                  </div>
                ))}
            </div>
          )}

          <Button onClick={handleDone}>閉じる</Button>
        </div>
      )}
    </Modal>
  );
}
