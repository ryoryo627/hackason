"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Alert } from "@/components/ui";
import {
  ArrowLeft,
  Upload,
  Download,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { patientsApi, type CreatePatientData } from "@/lib/api";

// CSV header mapping: Japanese header -> field key
const CSV_HEADERS = [
  { ja: "名前", key: "name" },
  { ja: "フリガナ", key: "name_kana" },
  { ja: "生年月日", key: "birth_date" },
  { ja: "性別", key: "gender" },
  { ja: "住所", key: "address" },
  { ja: "電話番号", key: "phone" },
  { ja: "主病名", key: "primary_diagnosis" },
  { ja: "事業所", key: "facility" },
  { ja: "エリア", key: "area" },
  { ja: "介護度", key: "care_level" },
] as const;

type CsvFieldKey = (typeof CSV_HEADERS)[number]["key"];

interface ParsedRow {
  index: number;
  data: Record<CsvFieldKey, string>;
  errors: string[];
}

interface ImportResult {
  success: boolean;
  total: number;
  created: number;
  patient_ids: string[];
  errors: { index: number; name: string; error: string }[];
  slack_status: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim());

  if (lines.length < 2) return [];

  // Skip header row (index 0), parse data rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const data: Record<string, string> = {};
    const errors: string[] = [];

    CSV_HEADERS.forEach((header, colIdx) => {
      data[header.key] = (values[colIdx] || "").trim();
    });

    // Validate: name is required
    if (!data.name) {
      errors.push("名前は必須です");
    }

    // Validate birth_date format if provided
    if (data.birth_date && !/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(data.birth_date)) {
      errors.push("生年月日の形式が不正です（YYYY-MM-DD）");
    }

    // Validate gender if provided
    if (data.gender) {
      const genderMap: Record<string, string> = {
        男: "male",
        男性: "male",
        male: "male",
        女: "female",
        女性: "female",
        female: "female",
        その他: "other",
        other: "other",
      };
      if (genderMap[data.gender]) {
        data.gender = genderMap[data.gender];
      } else if (!["male", "female", "other"].includes(data.gender)) {
        errors.push("性別は「男性」「女性」「その他」のいずれかです");
      }
    }

    rows.push({ index: i, data: data as Record<CsvFieldKey, string>, errors });
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  values.push(current);
  return values;
}

function downloadTemplateCSV() {
  const bom = "\uFEFF";
  const header = CSV_HEADERS.map((h) => h.ja).join(",");
  const sampleRow = "山田 太郎,ヤマダ タロウ,1950/01/15,男性,東京都新宿区1-1-1,03-1234-5678,慢性心不全,本院,新宿,要介護2";
  const content = bom + header + "\n" + sampleRow + "\n";
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "patients_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportPatientsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [createSlackChannels, setCreateSlackChannels] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const errorRows = parsedRows.filter((r) => r.errors.length > 0);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      alert("CSVファイルを選択してください");
      return;
    }
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setParsedRows(rows);
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;

    setImporting(true);
    try {
      const patients: Omit<CreatePatientData, "team_member_ids" | "create_slack_channel">[] =
        validRows.map((row) => ({
          name: row.data.name,
          ...(row.data.name_kana?.trim() && { name_kana: row.data.name_kana.trim() }),
          ...(row.data.birth_date?.trim() && {
            birth_date: row.data.birth_date.trim().replace(/\//g, "-"),
          }),
          ...(row.data.gender && { gender: row.data.gender }),
          ...(row.data.address && { address: row.data.address }),
          ...(row.data.phone && { phone: row.data.phone }),
          ...(row.data.primary_diagnosis && {
            primary_diagnosis: row.data.primary_diagnosis,
          }),
          ...(row.data.facility && { facility: row.data.facility }),
          ...(row.data.area && { area: row.data.area }),
          ...(row.data.care_level && { care_level: row.data.care_level }),
        }));

      const res = await patientsApi.bulkCreate({
        patients,
        create_slack_channels: createSlackChannels,
      });
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        total: validRows.length,
        created: 0,
        patient_ids: [],
        errors: [
          {
            index: 0,
            name: "",
            error: err instanceof Error ? err.message : "インポートに失敗しました",
          },
        ],
        slack_status: "error",
      });
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setFileName(null);
    setParsedRows([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Result screen
  if (result) {
    return (
      <AdminLayout title="CSVインポート結果">
        <div className="max-w-2xl mx-auto">
          <Card className="text-center py-8">
            {result.created > 0 ? (
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            ) : (
              <AlertTriangle className="w-16 h-16 text-danger mx-auto mb-4" />
            )}
            <h2 className="text-xl font-bold text-text-primary mb-2">
              インポート完了
            </h2>
            <p className="text-text-secondary mb-2">
              {result.total}件中 {result.created}件の患者を登録しました
            </p>
            {result.slack_status === "processing" && (
              <p className="text-sm text-accent-600 mb-4">
                Slackチャンネルをバックグラウンドで作成中です（1チャンネルあたり約3秒）
              </p>
            )}
            {result.slack_status === "not_configured" && (
              <p className="text-sm text-warning mb-4">
                Slackが設定されていないため、チャンネル作成をスキップしました
              </p>
            )}
            {result.errors.length > 0 && (
              <div className="mt-4 text-left max-w-md mx-auto">
                <h3 className="text-sm font-medium text-danger mb-2">
                  エラー ({result.errors.length}件)
                </h3>
                <div className="bg-danger-light border border-danger/20 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-sm text-danger">
                      {err.name ? `${err.name}: ` : ""}
                      {err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <Button variant="secondary" onClick={resetForm}>
                別のCSVをインポート
              </Button>
              <Button onClick={() => router.push("/patients")}>
                患者一覧に戻る
              </Button>
            </div>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="CSV一括インポート">
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <Button variant="ghost" size="sm" onClick={() => router.push("/patients")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          患者一覧に戻る
        </Button>

        {/* Step 1: Template download */}
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                1. テンプレートCSVをダウンロード
              </h3>
              <p className="text-sm text-text-secondary">
                テンプレートに沿ってCSVファイルを作成してください。名前のみ必須です。
              </p>
            </div>
            <Button variant="secondary" onClick={downloadTemplateCSV}>
              <Download className="w-4 h-4 mr-2" />
              テンプレート
            </Button>
          </div>
        </Card>

        {/* Step 2: File upload */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-text-primary mb-3">
            2. CSVファイルをアップロード
          </h3>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-accent-500 bg-accent-50"
                : fileName
                ? "border-success/30 bg-success-light"
                : "border-border-strong hover:border-text-tertiary hover:bg-bg-secondary"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            {fileName ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-success" />
                <div className="text-left">
                  <p className="font-medium text-text-primary">{fileName}</p>
                  <p className="text-sm text-text-secondary">
                    {parsedRows.length}行のデータ（有効: {validRows.length}件、エラー:{" "}
                    {errorRows.length}件）
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetForm();
                  }}
                  className="ml-4 p-1 text-text-tertiary hover:text-text-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
                <p className="text-text-secondary mb-1">
                  CSVファイルをドラッグ＆ドロップ
                </p>
                <p className="text-sm text-text-tertiary">
                  またはクリックしてファイルを選択
                </p>
              </>
            )}
          </div>
        </Card>

        {/* Step 3: Preview table */}
        {parsedRows.length > 0 && (
          <Card className="mb-6" padding="none">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">
                3. データプレビュー
              </h3>
              {errorRows.length > 0 && (
                <p className="text-sm text-warning mt-1">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  {errorRows.length}件のエラー行はインポートされません
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg-secondary border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium w-8">
                      #
                    </th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">
                      名前
                    </th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">
                      フリガナ
                    </th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">
                      生年月日
                    </th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">
                      性別
                    </th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">
                      主病名
                    </th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">
                      事業所
                    </th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">
                      エリア
                    </th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">
                      介護度
                    </th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium w-24">
                      状態
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {parsedRows.map((row) => {
                    const hasError = row.errors.length > 0;
                    const genderDisplay =
                      row.data.gender === "male"
                        ? "男性"
                        : row.data.gender === "female"
                        ? "女性"
                        : row.data.gender === "other"
                        ? "その他"
                        : row.data.gender || "";
                    return (
                      <tr
                        key={row.index}
                        className={hasError ? "bg-danger-light" : ""}
                      >
                        <td className="py-2 px-3 text-text-tertiary">{row.index}</td>
                        <td className="py-2 px-3 font-medium">
                          {row.data.name || (
                            <span className="text-danger">（空）</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-text-secondary">
                          {row.data.name_kana || "-"}
                        </td>
                        <td className="py-2 px-3 text-text-secondary">
                          {row.data.birth_date || "-"}
                        </td>
                        <td className="py-2 px-3 text-text-secondary">
                          {genderDisplay || "-"}
                        </td>
                        <td className="py-2 px-3 text-text-secondary">
                          {row.data.primary_diagnosis || "-"}
                        </td>
                        <td className="py-2 px-3 text-text-secondary">
                          {row.data.facility || "-"}
                        </td>
                        <td className="py-2 px-3 text-text-secondary">
                          {row.data.area || "-"}
                        </td>
                        <td className="py-2 px-3 text-text-secondary">
                          {row.data.care_level || "-"}
                        </td>
                        <td className="py-2 px-3">
                          {hasError ? (
                            <span
                              className="text-danger text-xs"
                              title={row.errors.join(", ")}
                            >
                              {row.errors[0]}
                            </span>
                          ) : (
                            <span className="text-success text-xs">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Step 4: Options & Import */}
        {validRows.length > 0 && !result && (
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-3">
              4. インポート設定
            </h3>
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={createSlackChannels}
                onChange={(e) => setCreateSlackChannels(e.target.checked)}
                className="w-4 h-4 text-accent-600 border-border-strong rounded focus:ring-accent-500"
              />
              <div>
                <span className="text-sm text-text-secondary">
                  Slackチャンネルを作成する
                </span>
                <p className="text-xs text-text-tertiary">
                  バックグラウンドで順次作成されます（1件あたり約3秒）
                </p>
              </div>
            </label>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <p className="text-sm text-text-secondary">
                <span className="font-medium text-text-primary">
                  {validRows.length}件
                </span>
                の患者をインポートします
                {errorRows.length > 0 && (
                  <span className="text-warning">
                    （{errorRows.length}件のエラー行をスキップ）
                  </span>
                )}
              </p>
              <Button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    インポート中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    インポート実行
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
