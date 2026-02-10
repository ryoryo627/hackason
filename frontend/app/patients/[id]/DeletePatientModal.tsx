"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button, Input } from "@/components/ui";
import { AlertTriangle, Loader2, CheckCircle, XCircle } from "lucide-react";
import { patientsApi, type Patient } from "@/lib/api";

type Step = "warning" | "confirm" | "result";

interface DeletePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
}

export function DeletePatientModal({ isOpen, onClose, patient }: DeletePatientModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("warning");
  const [confirmName, setConfirmName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    slack?: { channel_archived?: boolean; error?: string } | null;
    error?: string;
  } | null>(null);

  const nameMatch = confirmName.trim() === patient.name;

  const handleClose = () => {
    setStep("warning");
    setConfirmName("");
    setResult(null);
    onClose();
  };

  const handleExecute = async () => {
    setLoading(true);
    try {
      const res = await patientsApi.delete(patient.id);
      setResult({ success: true, slack: res.slack });
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "アーカイブに失敗しました",
      });
    } finally {
      setLoading(false);
      setStep("result");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={step === "result" ? handleClose : handleClose} title="患者アーカイブ" size="md">
      {/* Step 1: Warning */}
      {step === "warning" && (
        <div>
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-text-primary mb-1">
                「{patient.name}」をアーカイブしますか？
              </p>
              <p className="text-sm text-text-secondary">
                以下の処理が実行されます:
              </p>
            </div>
          </div>

          <ul className="text-sm text-text-secondary space-y-2 ml-9 mb-6">
            <li className="flex items-start gap-2">
              <span className="text-text-tertiary mt-0.5">&#8226;</span>
              患者ステータスを「アーカイブ済み」に変更
            </li>
            <li className="flex items-start gap-2">
              <span className="text-text-tertiary mt-0.5">&#8226;</span>
              患者一覧に表示されなくなります
            </li>
            {patient.slack_channel_id && (
              <li className="flex items-start gap-2">
                <span className="text-text-tertiary mt-0.5">&#8226;</span>
                Slackチャンネルをアーカイブ
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-text-tertiary mt-0.5">&#8226;</span>
              過去の報告・アラートデータは保持されます
            </li>
          </ul>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={handleClose}>
              キャンセル
            </Button>
            <Button variant="danger" onClick={() => setStep("confirm")}>
              次へ
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Name confirmation */}
      {step === "confirm" && (
        <div>
          <div className="bg-danger-light border border-danger/20 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-text-primary font-medium">
                この操作は簡単に取り消せません
              </p>
            </div>
          </div>

          <p className="text-sm text-text-secondary mb-3">
            確認のため、患者名「<strong>{patient.name}</strong>」を入力してください:
          </p>

          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={patient.name}
            className="mb-6"
          />

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setStep("warning"); setConfirmName(""); }}>
              戻る
            </Button>
            <Button
              variant="danger-fill"
              disabled={!nameMatch || loading}
              onClick={handleExecute}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  処理中...
                </>
              ) : (
                "アーカイブ実行"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === "result" && result && (
        <div className="text-center py-4">
          {result.success ? (
            <>
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                アーカイブ完了
              </h3>
              <p className="text-sm text-text-secondary mb-2">
                「{patient.name}」をアーカイブしました。
              </p>
              {result.slack?.channel_archived && (
                <p className="text-sm text-success mb-4">
                  Slackチャンネルもアーカイブしました
                </p>
              )}
              {result.slack?.error && (
                <p className="text-sm text-warning mb-4">
                  Slackチャンネル: {result.slack.error}
                </p>
              )}
              <Button onClick={() => router.push("/patients")}>
                患者一覧に戻る
              </Button>
            </>
          ) : (
            <>
              <XCircle className="w-12 h-12 text-danger mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                エラーが発生しました
              </h3>
              <p className="text-sm text-danger mb-4">{result.error}</p>
              <Button variant="secondary" onClick={handleClose}>
                閉じる
              </Button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
