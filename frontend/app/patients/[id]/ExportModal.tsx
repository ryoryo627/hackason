"use client";

import { useState, useRef, useCallback } from "react";
import QRCode from "react-qr-code";
import { Modal } from "@/components/ui/Modal";
import { Button, Input, Card } from "@/components/ui";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import {
  FileText,
  Copy,
  QrCode,
  Download,
  Check,
  Printer,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import type { Patient, BPSContext } from "@/lib/api";

type ModalView = "select" | "referral" | "qrcode";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  context: BPSContext | null;
}

interface ReferralData {
  destInstitution: string;
  destDepartment: string;
  destDoctor: string;
  srcInstitution: string;
  srcDoctor: string;
  srcContact: string;
  diagnosis: string;
  referralPurpose: string;
  medicalHistory: string;
  clinicalCourse: string;
  currentMedication: string;
  remarks: string;
}

function buildBPSNarrative(context: BPSContext | null): string {
  if (!context?.bps_summary) return "";
  const s = context.bps_summary;
  const sections: string[] = [];
  if (s.bio_narrative) {
    let text = `【身体面】\n${s.bio_narrative}`;
    if (s.bio_trend) text += `\n（傾向: ${s.bio_trend}）`;
    sections.push(text);
  }
  if (s.psycho_narrative) {
    let text = `【心理面】\n${s.psycho_narrative}`;
    if (s.psycho_trend) text += `\n（傾向: ${s.psycho_trend}）`;
    sections.push(text);
  }
  if (s.social_narrative) {
    let text = `【社会面】\n${s.social_narrative}`;
    if (s.social_trend) text += `\n（傾向: ${s.social_trend}）`;
    sections.push(text);
  }
  return sections.join("\n\n");
}

function formatAge(birthDate: string | undefined): string {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age}歳`;
}

function formatGender(gender: string | undefined): string {
  if (!gender) return "";
  if (gender === "male") return "男性";
  if (gender === "female") return "女性";
  return gender;
}

function toWareki(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (y >= 2019) return `令和${y - 2018}年${m}月${d}日`;
  if (y >= 1989) return `平成${y - 1988}年${m}月${d}日`;
  if (y >= 1926) return `昭和${y - 1925}年${m}月${d}日`;
  return `${y}年${m}月${d}日`;
}

function buildPlainText(patient: Patient, context: BPSContext | null): string {
  const lines: string[] = [];
  lines.push("【患者情報】");
  lines.push(`氏名: ${patient.name}${patient.name_kana ? `（${patient.name_kana}）` : ""}`);
  if (patient.birth_date) {
    lines.push(`生年月日: ${patient.birth_date}${patient.age ? `（${patient.age}歳）` : `（${formatAge(patient.birth_date)}）`}`);
  }
  if (patient.gender) lines.push(`性別: ${formatGender(patient.gender)}`);
  if (patient.care_level) lines.push(`介護度: ${patient.care_level}`);
  if (patient.primary_diagnosis) lines.push(`主病名: ${patient.primary_diagnosis}`);
  if (patient.facility) lines.push(`関連事業所: ${patient.facility}`);
  lines.push("");
  lines.push("【患者背景サマリ】");

  if (context?.bps_summary) {
    const s = context.bps_summary;
    if (s.bio_narrative) {
      lines.push(`■ 身体面（Biological）`);
      lines.push(s.bio_narrative);
      lines.push("");
    }
    if (s.psycho_narrative) {
      lines.push(`■ 心理面（Psychological）`);
      lines.push(s.psycho_narrative);
      lines.push("");
    }
    if (s.social_narrative) {
      lines.push(`■ 社会面（Social）`);
      lines.push(s.social_narrative);
      lines.push("");
    }
  } else {
    lines.push("サマリーが生成されていません");
    lines.push("");
  }

  lines.push(`最終更新: ${new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}`);
  return lines.join("\n");
}

function truncateForQR(text: string, maxLength: number = 2900): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// ─── Select Screen ───────────────────────────────────────────
function SelectView({
  onSelectReferral,
  onSelectCopy,
  onSelectQR,
  copied,
}: {
  onSelectReferral: () => void;
  onSelectCopy: () => void;
  onSelectQR: () => void;
  copied: boolean;
}) {
  const options = [
    {
      icon: FileText,
      title: "診療情報提供書",
      description: "厚労省様式準拠の紹介状を作成・印刷",
      onClick: onSelectReferral,
      iconColor: "text-accent-600",
      iconBg: "bg-accent-50",
    },
    {
      icon: copied ? Check : Copy,
      title: "テキストコピー",
      description: "患者情報をクリップボードにコピー",
      onClick: onSelectCopy,
      iconColor: copied ? "text-success" : "text-emerald-600",
      iconBg: copied ? "bg-success-light" : "bg-emerald-50",
    },
    {
      icon: QrCode,
      title: "QRコード出力",
      description: "サマリをQRコードに変換・保存",
      onClick: onSelectQR,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
    },
  ];

  return (
    <div className="space-y-3">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <Card
            key={opt.title}
            interactive
            className="flex items-center gap-4"
            padding="md"
          >
            <button
              className="flex items-center gap-4 w-full text-left"
              onClick={opt.onClick}
            >
              <div className={`w-10 h-10 rounded-lg ${opt.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${opt.iconColor}`} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-text-primary">{opt.title}</p>
                <p className="text-sm text-text-secondary">{opt.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary flex-shrink-0" />
            </button>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Referral Letter Editor ─────────────────────────────────
function ReferralView({
  patient,
  referralData,
  onChange,
  onBack,
  onPrint,
}: {
  patient: Patient;
  referralData: ReferralData;
  onChange: (field: keyof ReferralData, value: string) => void;
  onBack: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-1" />
        エクスポート選択に戻る
      </Button>

      {/* Referral destination */}
      <fieldset>
        <legend className="text-sm font-semibold text-text-primary mb-3 border-b border-border-light pb-1">
          紹介先
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="医療機関名"
            placeholder="○○病院"
            value={referralData.destInstitution}
            onChange={(e) => onChange("destInstitution", e.target.value)}
          />
          <Input
            label="診療科"
            placeholder="循環器内科"
            value={referralData.destDepartment}
            onChange={(e) => onChange("destDepartment", e.target.value)}
          />
        </div>
        <div className="mt-3">
          <Input
            label="医師名"
            placeholder="（任意）「先生」は自動付与されます"
            value={referralData.destDoctor}
            onChange={(e) => onChange("destDoctor", e.target.value)}
          />
        </div>
      </fieldset>

      {/* Referral source */}
      <fieldset>
        <legend className="text-sm font-semibold text-text-primary mb-3 border-b border-border-light pb-1">
          紹介元
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="医療機関名"
            placeholder="△△クリニック"
            value={referralData.srcInstitution}
            onChange={(e) => onChange("srcInstitution", e.target.value)}
          />
          <Input
            label="医師名"
            placeholder="医師名"
            value={referralData.srcDoctor}
            onChange={(e) => onChange("srcDoctor", e.target.value)}
          />
        </div>
        <div className="mt-3">
          <Input
            label="連絡先"
            placeholder="03-XXXX-XXXX"
            value={referralData.srcContact}
            onChange={(e) => onChange("srcContact", e.target.value)}
          />
        </div>
      </fieldset>

      {/* Patient info (read-only display) */}
      <fieldset>
        <legend className="text-sm font-semibold text-text-primary mb-3 border-b border-border-light pb-1">
          患者情報（自動入力）
        </legend>
        <div className="bg-bg-secondary rounded-lg p-3 text-sm text-text-secondary space-y-1">
          <p>
            <span className="text-text-tertiary">氏名:</span>{" "}
            <span className="text-text-primary font-medium">{patient.name}</span>
            {patient.name_kana && <span className="ml-1">（{patient.name_kana}）</span>}
          </p>
          <div className="flex flex-wrap gap-x-6">
            {patient.birth_date && (
              <p>
                <span className="text-text-tertiary">生年月日:</span>{" "}
                {patient.birth_date}
                （{patient.age ? `${patient.age}歳` : formatAge(patient.birth_date)}）
              </p>
            )}
            {patient.gender && (
              <p>
                <span className="text-text-tertiary">性別:</span>{" "}
                {formatGender(patient.gender)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6">
            {patient.care_level && (
              <p>
                <span className="text-text-tertiary">介護度:</span>{" "}
                {patient.care_level}
              </p>
            )}
            {patient.facility && (
              <p>
                <span className="text-text-tertiary">関連事業所:</span>{" "}
                {patient.facility}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      {/* Diagnosis */}
      <Textarea
        label="傷病名"
        placeholder="#1 慢性心不全&#10;#2 ..."
        value={referralData.diagnosis}
        onChange={(e) => onChange("diagnosis", e.target.value)}
        className="min-h-[60px]"
      />

      {/* Purpose */}
      <Textarea
        label="紹介目的"
        placeholder="精査・加療のご依頼"
        value={referralData.referralPurpose}
        onChange={(e) => onChange("referralPurpose", e.target.value)}
        className="min-h-[60px]"
      />

      {/* Medical history */}
      <Textarea
        label="既往歴・家族歴"
        placeholder="特記事項があれば記載"
        value={referralData.medicalHistory}
        onChange={(e) => onChange("medicalHistory", e.target.value)}
        className="min-h-[60px]"
      />

      {/* Clinical course (auto-filled from BPS) */}
      <Textarea
        label="症状経過及び検査結果（BPSサマリから自動生成・編集可能）"
        value={referralData.clinicalCourse}
        onChange={(e) => onChange("clinicalCourse", e.target.value)}
        className="min-h-[160px]"
      />

      {/* Current medication */}
      <Textarea
        label="現在の処方"
        placeholder="お薬手帳参照"
        value={referralData.currentMedication}
        onChange={(e) => onChange("currentMedication", e.target.value)}
        className="min-h-[60px]"
      />

      {/* Remarks */}
      <Textarea
        label="備考"
        placeholder="患者背景、性格傾向、注意事項等"
        value={referralData.remarks}
        onChange={(e) => onChange("remarks", e.target.value)}
        className="min-h-[60px]"
      />

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2 border-t border-border-light">
        <Button variant="secondary" onClick={onBack}>
          キャンセル
        </Button>
        <Button onClick={onPrint}>
          <Printer className="w-4 h-4 mr-2" />
          印刷プレビュー
        </Button>
      </div>
    </div>
  );
}

// ─── QR Code View ───────────────────────────────────────────
function QRCodeView({
  text,
  onBack,
}: {
  text: string;
  onBack: () => void;
}) {
  const [qrSize, setQRSize] = useState<256 | 384 | 512>(256);
  const [downloaded, setDownloaded] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const qrText = truncateForQR(text);
  const isTruncated = text.length > 2900;

  const handleDownload = useCallback(() => {
    const svgElement = qrRef.current?.querySelector("svg");
    if (!svgElement) return;

    const canvas = document.createElement("canvas");
    canvas.width = qrSize;
    canvas.height = qrSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, qrSize, qrSize);
      ctx.drawImage(img, 0, 0, qrSize, qrSize);
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `qr-code-${qrSize}px.png`;
      link.href = pngUrl;
      link.click();
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
  }, [qrSize]);

  const sizeOptions: { value: 256 | 384 | 512; label: string }[] = [
    { value: 256, label: "256px" },
    { value: 384, label: "384px" },
    { value: 512, label: "512px" },
  ];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-1" />
        エクスポート選択に戻る
      </Button>

      {isTruncated && (
        <div className="bg-warning-light border border-warning/20 rounded-lg p-3 text-sm text-text-secondary">
          テキストがQRコードの容量上限を超えたため、要約版を使用しています。
        </div>
      )}

      {/* Size selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">サイズ:</span>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {sizeOptions.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => setQRSize(opt.value)}
              className={`px-3 py-1 text-sm transition-colors ${
                i > 0 ? "border-l border-border" : ""
              } ${
                qrSize === opt.value
                  ? "bg-bg-active text-text-primary font-medium"
                  : "hover:bg-bg-tertiary text-text-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* QR Code display */}
      <div className="flex justify-center py-4">
        <div
          ref={qrRef}
          className="bg-white p-4 rounded-lg border border-border inline-block"
        >
          <QRCode value={qrText} size={qrSize} level="L" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2 border-t border-border-light">
        <Button variant="secondary" onClick={onBack}>
          戻る
        </Button>
        <Button onClick={handleDownload}>
          {downloaded ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              保存しました
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              PNG画像を保存
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Print Preview (opens new window) ───────────────────────
function openPrintPreview(patient: Patient, data: ReferralData) {
  const today = toWareki(new Date());
  const birthWareki = patient.birth_date ? toWareki(new Date(patient.birth_date)) : "";
  const age = patient.age ? `${patient.age}歳` : formatAge(patient.birth_date);

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>診療情報提供書 - ${patient.name}</title>
<style>
  @page { size: A4; margin: 15mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #000;
  }
  .page {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px 0;
  }
  h1 {
    text-align: center;
    font-size: 18pt;
    font-weight: bold;
    letter-spacing: 0.5em;
    margin-bottom: 20px;
  }
  .date-line {
    text-align: right;
    margin-bottom: 16px;
    font-size: 10.5pt;
  }
  .dest-block {
    margin-bottom: 12px;
    font-size: 10.5pt;
    line-height: 1.8;
  }
  .dest-block p { margin: 0; }
  .src-block {
    text-align: right;
    margin-bottom: 20px;
    font-size: 10.5pt;
    line-height: 1.8;
  }
  .src-block p { margin: 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0;
  }
  table + table {
    border-top: none;
  }
  th, td {
    border: 1px solid #000;
    padding: 6px 10px;
    font-size: 10.5pt;
    vertical-align: top;
    text-align: left;
    font-weight: normal;
  }
  th {
    width: 130px;
    white-space: nowrap;
    font-weight: bold;
    background: none;
  }
  td {
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .patient-table th {
    width: auto;
  }
  .content-cell {
    min-height: 2em;
  }
  .content-cell-lg {
    min-height: 6em;
  }
  @media print {
    body { margin: 0; }
    .page { padding: 0; max-width: none; }
    .no-print { display: none !important; }
    table { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  }
  .print-bar {
    text-align: center;
    padding: 16px;
    background: #f0f4f8;
    border-radius: 8px;
    margin-bottom: 24px;
  }
  .print-bar button {
    background: #2563eb;
    color: white;
    border: none;
    padding: 10px 32px;
    font-size: 14px;
    border-radius: 6px;
    cursor: pointer;
    margin: 0 8px;
  }
  .print-bar button:hover { background: #1d4ed8; }
  .print-bar button.secondary {
    background: #e5e7eb;
    color: #374151;
  }
  .print-bar button.secondary:hover { background: #d1d5db; }
</style>
</head>
<body>
<div class="print-bar no-print">
  <button onclick="window.print()">印刷 / PDF保存</button>
  <button class="secondary" onclick="window.close()">閉じる</button>
</div>
<div class="page">

  <h1>診 療 情 報 提 供 書</h1>

  <p class="date-line">${today}</p>

  <div class="dest-block">
    <p>${escapeHtml(data.destInstitution || "　")}${data.destDepartment ? `　${escapeHtml(data.destDepartment)}` : ""}</p>
    <p>${data.destDoctor ? `${escapeHtml(data.destDoctor)}先生　御机下` : "　"}</p>
  </div>

  <div class="src-block">
    <p>${escapeHtml(data.srcInstitution || "　")}</p>
    ${data.srcContact ? `<p>TEL: ${escapeHtml(data.srcContact)}</p>` : ""}
    <p>${data.srcDoctor ? `医師　${escapeHtml(data.srcDoctor)}　㊞` : "　"}</p>
  </div>

  <table class="patient-table">
    <tr>
      <th style="width:80px;">患者氏名</th>
      <td>${escapeHtml(patient.name)}${patient.name_kana ? `（${escapeHtml(patient.name_kana)}）` : ""}</td>
      <th style="width:50px;">性別</th>
      <td style="width:80px;">${escapeHtml(formatGender(patient.gender) || "　")}</td>
    </tr>
    <tr>
      <th>生年月日</th>
      <td>${birthWareki ? `${escapeHtml(birthWareki)}（${escapeHtml(age)}）` : "　"}</td>
      <th>介護度</th>
      <td>${escapeHtml(patient.care_level || "　")}</td>
    </tr>
  </table>

  <table>
    <tr>
      <th>傷病名</th>
      <td class="content-cell">${data.diagnosis ? escapeHtml(data.diagnosis) : "&nbsp;"}</td>
    </tr>
    <tr>
      <th>紹介目的</th>
      <td class="content-cell">${data.referralPurpose ? escapeHtml(data.referralPurpose) : "&nbsp;"}</td>
    </tr>
    <tr>
      <th>既往歴・<br>家族歴</th>
      <td class="content-cell">${data.medicalHistory ? escapeHtml(data.medicalHistory) : "&nbsp;"}</td>
    </tr>
    <tr>
      <th>症状経過及び<br>検査結果</th>
      <td class="content-cell-lg">${data.clinicalCourse ? escapeHtml(data.clinicalCourse) : "&nbsp;"}</td>
    </tr>
    <tr>
      <th>現在の処方</th>
      <td class="content-cell">${data.currentMedication ? escapeHtml(data.currentMedication) : "&nbsp;"}</td>
    </tr>
    <tr>
      <th>備考</th>
      <td class="content-cell">${data.remarks ? escapeHtml(data.remarks) : "&nbsp;"}</td>
    </tr>
  </table>

</div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

// ─── Main Export Modal ──────────────────────────────────────
export function ExportModal({ isOpen, onClose, patient, context }: ExportModalProps) {
  const [view, setView] = useState<ModalView>("select");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const [referralData, setReferralData] = useState<ReferralData>(() => ({
    destInstitution: "",
    destDepartment: "",
    destDoctor: "",
    srcInstitution: "",
    srcDoctor: "",
    srcContact: "",
    diagnosis: patient.primary_diagnosis || "",
    referralPurpose: "",
    medicalHistory: "",
    clinicalCourse: buildBPSNarrative(context),
    currentMedication: "",
    remarks: "",
  }));

  const handleClose = () => {
    setView("select");
    setCopied(false);
    onClose();
  };

  const handleCopyText = async () => {
    const text = buildPlainText(patient, context);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("クリップボードにコピーしました", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("コピーに失敗しました", "error");
    }
  };

  const handleReferralFieldChange = (field: keyof ReferralData, value: string) => {
    setReferralData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePrint = () => {
    openPrintPreview(patient, referralData);
  };

  const plainText = buildPlainText(patient, context);

  const titles: Record<ModalView, string> = {
    select: "エクスポート",
    referral: "診療情報提供書 作成",
    qrcode: "QRコード出力",
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={titles[view]}
      size={view === "referral" ? "xl" : "lg"}
    >
      {view === "select" && (
        <SelectView
          onSelectReferral={() => {
            setReferralData((prev) => ({
              ...prev,
              diagnosis: patient.primary_diagnosis || prev.diagnosis,
              clinicalCourse: prev.clinicalCourse || buildBPSNarrative(context),
            }));
            setView("referral");
          }}
          onSelectCopy={handleCopyText}
          onSelectQR={() => setView("qrcode")}
          copied={copied}
        />
      )}

      {view === "referral" && (
        <ReferralView
          patient={patient}
          referralData={referralData}
          onChange={handleReferralFieldChange}
          onBack={() => setView("select")}
          onPrint={handlePrint}
        />
      )}

      {view === "qrcode" && (
        <QRCodeView
          text={plainText}
          onBack={() => setView("select")}
        />
      )}
    </Modal>
  );
}
