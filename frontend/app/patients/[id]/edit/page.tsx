"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Input, Select, Textarea, TagInput } from "@/components/ui";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import {
  patientsApi,
  settingsApi,
  type Facility,
  type Area,
} from "@/lib/api";

const MEDICAL_PROCEDURE_SUGGESTIONS = [
  "HOT", "吸入", "CV管理", "PEG", "バルーン", "褥瘡処置",
  "IVH", "気管切開", "人工呼吸器", "在宅自己注射", "ストーマ", "インスリン",
];

export default function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    updated_fields: string[];
    slack_sync?: {
      channel_renamed?: boolean;
      rename_error?: string;
      anchor_updated?: boolean;
      anchor_error?: string;
    } | null;
  } | null>(null);

  // Master data
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  // Basic fields
  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState("");
  const [facility, setFacility] = useState("");
  const [area, setArea] = useState("");
  const [careLevel, setCareLevel] = useState("");
  const [status, setStatus] = useState("");
  const [riskLevel, setRiskLevel] = useState("");

  // 在宅5つの呪文
  const [insuranceType, setInsuranceType] = useState("");
  const [adlDescription, setAdlDescription] = useState("");
  const [specialDiseaseFlag, setSpecialDiseaseFlag] = useState("");
  const [medicalProcedures, setMedicalProcedures] = useState<string[]>([]);
  const [residenceType, setResidenceType] = useState("");

  // 紹介元・経緯
  const [referralInstitution, setReferralInstitution] = useState("");
  const [referralDoctor, setReferralDoctor] = useState("");
  const [referralDepartment, setReferralDepartment] = useState("");
  const [referralDate, setReferralDate] = useState("");
  const [clinicalBackground, setClinicalBackground] = useState("");

  // キーパーソン
  const [keyPersonName, setKeyPersonName] = useState("");
  const [keyPersonRelationship, setKeyPersonRelationship] = useState("");
  const [keyPersonPhone, setKeyPersonPhone] = useState("");

  // Load patient data and master data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [patientRes, facilitiesRes, areasRes] = await Promise.all([
          patientsApi.get(id),
          settingsApi.listFacilities().catch(() => ({ facilities: [], total: 0 })),
          settingsApi.listAreas().catch(() => ({ areas: [], total: 0 })),
        ]);

        const p = patientRes.patient;
        setName(p.name || "");
        setNameKana(p.name_kana || "");
        setBirthDate(p.birth_date || "");
        setGender(p.gender || "");
        setAddress(p.address || "");
        setPhone(p.phone || "");
        setPrimaryDiagnosis(p.primary_diagnosis || "");
        setFacility(p.facility || "");
        setArea(p.area || "");
        setCareLevel(p.care_level || "");
        setStatus(p.status || "active");
        setRiskLevel(p.risk_level || "low");
        // 5つの呪文
        setInsuranceType(p.insurance_type || "");
        setAdlDescription(p.adl_description || "");
        setSpecialDiseaseFlag(p.special_disease_flag || "");
        setMedicalProcedures(p.medical_procedures || []);
        setResidenceType(p.residence_type || "");
        // 紹介元
        setReferralInstitution(p.referral_source?.institution_name || "");
        setReferralDoctor(p.referral_source?.doctor_name || "");
        setReferralDepartment(p.referral_source?.department || "");
        setReferralDate(p.referral_source?.referral_date || "");
        setClinicalBackground(p.clinical_background || "");
        // キーパーソン
        setKeyPersonName(p.key_person?.name || "");
        setKeyPersonRelationship(p.key_person?.relationship || "");
        setKeyPersonPhone(p.key_person?.phone || "");

        setFacilities(facilitiesRes.facilities);
        setAreas(areasRes.areas);
      } catch (err) {
        setError(err instanceof Error ? err.message : "患者データの取得に失敗しました");
      } finally {
        setLoadingData(false);
        setLoadingMaster(false);
      }
    }
    loadData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("患者名は必須です");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build referral_source object
      const referralSource =
        referralInstitution || referralDoctor || referralDepartment || referralDate
          ? {
              institution_name: referralInstitution || undefined,
              doctor_name: referralDoctor || undefined,
              department: referralDepartment || undefined,
              referral_date: referralDate || undefined,
            }
          : undefined;

      // Build key_person object
      const keyPerson =
        keyPersonName || keyPersonPhone
          ? {
              name: keyPersonName || undefined,
              relationship: keyPersonRelationship || undefined,
              phone: keyPersonPhone || undefined,
            }
          : undefined;

      const data: Record<string, unknown> = {};
      if (name.trim()) data.name = name.trim();
      if (nameKana.trim()) data.name_kana = nameKana.trim();
      if (birthDate) data.birth_date = birthDate;
      if (gender) data.gender = gender;
      if (address.trim()) data.address = address.trim();
      if (phone.trim()) data.phone = phone.trim();
      if (primaryDiagnosis.trim()) data.primary_diagnosis = primaryDiagnosis.trim();
      if (facility) data.facility = facility;
      if (area) data.area = area;
      if (careLevel) data.care_level = careLevel;
      if (status) data.status = status;
      if (riskLevel) data.risk_level = riskLevel;
      // 5つの呪文
      if (insuranceType) data.insurance_type = insuranceType;
      if (adlDescription.trim()) data.adl_description = adlDescription.trim();
      if (specialDiseaseFlag) data.special_disease_flag = specialDiseaseFlag;
      if (medicalProcedures.length > 0) data.medical_procedures = medicalProcedures;
      if (residenceType) data.residence_type = residenceType;
      // 紹介元
      if (referralSource) data.referral_source = referralSource;
      if (clinicalBackground.trim()) data.clinical_background = clinicalBackground.trim();
      if (keyPerson) data.key_person = keyPerson;

      const result = await patientsApi.update(id, data);
      setSuccess({
        updated_fields: result.updated_fields,
        slack_sync: result.slack_sync,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "患者情報の更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <AdminLayout title="患者編集">
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
        </div>
      </AdminLayout>
    );
  }

  // Success screen
  if (success) {
    const fieldLabels: Record<string, string> = {
      name: "患者名",
      name_kana: "フリガナ",
      birth_date: "生年月日",
      age: "年齢",
      gender: "性別",
      address: "住所",
      phone: "電話番号",
      primary_diagnosis: "主病名",
      facility: "事業所",
      area: "地区",
      care_level: "介護度",
      status: "ステータス",
      risk_level: "リスクレベル",
      insurance_type: "保険種別",
      adl_description: "ADL概要",
      special_disease_flag: "特定疾患",
      medical_procedures: "医療処置",
      residence_type: "居住場所",
      referral_source: "紹介元",
      clinical_background: "経緯",
      key_person: "キーパーソン",
    };

    return (
      <AdminLayout title="更新完了">
        <Card className="max-w-lg mx-auto text-center py-8">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">
            患者情報を更新しました
          </h2>

          {success.updated_fields.length > 0 && (
            <div className="text-sm text-text-secondary mb-4">
              <p className="font-medium mb-1">更新されたフィールド:</p>
              <div className="flex flex-wrap gap-1 justify-center">
                {success.updated_fields.map((f) => (
                  <span
                    key={f}
                    className="px-2 py-0.5 bg-accent-50 text-accent-700 rounded text-xs"
                  >
                    {fieldLabels[f] || f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {success.slack_sync && (
            <div className="text-sm mb-4 space-y-1">
              {success.slack_sync.channel_renamed && (
                <p className="text-success">Slackチャンネル名を変更しました</p>
              )}
              {success.slack_sync.rename_error && (
                <p className="text-warning">
                  チャンネル名変更: {success.slack_sync.rename_error}
                </p>
              )}
              {success.slack_sync.anchor_updated && (
                <p className="text-success">アンカーメッセージを更新しました</p>
              )}
              {success.slack_sync.anchor_error && (
                <p className="text-warning">
                  アンカー更新: {success.slack_sync.anchor_error}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => router.push("/patients")}>
              患者一覧に戻る
            </Button>
            <Button onClick={() => router.push(`/patients/${id}`)}>
              患者詳細を表示
            </Button>
          </div>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="患者編集">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Button variant="ghost" size="sm" onClick={() => router.push(`/patients/${id}`)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          患者詳細に戻る
        </Button>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-danger-light border border-danger/20 rounded-lg text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">基本情報</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  患者名 <span className="text-danger">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: 山田 太郎"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  フリガナ
                </label>
                <Input
                  value={nameKana}
                  onChange={(e) => setNameKana(e.target.value)}
                  placeholder="例: ヤマダ タロウ"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    生年月日
                  </label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
                <Select
                  label="性別"
                  value={gender}
                  onChange={(val) => setGender(val)}
                  options={[
                    { value: "", label: "選択してください" },
                    { value: "male", label: "男性" },
                    { value: "female", label: "女性" },
                    { value: "other", label: "その他" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">住所</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="例: 東京都新宿区..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">電話番号</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="例: 03-1234-5678"
                />
              </div>
            </div>
          </Card>

          {/* Medical Info */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">医療情報</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">主病名</label>
                <Input
                  value={primaryDiagnosis}
                  onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                  placeholder="例: 慢性心不全"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="事業所"
                  value={facility}
                  onChange={(val) => setFacility(val)}
                  options={[
                    { value: "", label: "選択してください" },
                    ...facilities.map((f) => ({ value: f.name, label: f.name })),
                  ]}
                  disabled={loadingMaster}
                />
                <Select
                  label="地区"
                  value={area}
                  onChange={(val) => setArea(val)}
                  options={[
                    { value: "", label: "選択してください" },
                    ...areas.map((a) => ({ value: a.name, label: a.name })),
                  ]}
                  disabled={loadingMaster}
                />
              </div>
              <Select
                label="介護度"
                value={careLevel}
                onChange={(val) => setCareLevel(val)}
                options={[
                  { value: "", label: "選択してください" },
                  { value: "要支援1", label: "要支援1" },
                  { value: "要支援2", label: "要支援2" },
                  { value: "要介護1", label: "要介護1" },
                  { value: "要介護2", label: "要介護2" },
                  { value: "要介護3", label: "要介護3" },
                  { value: "要介護4", label: "要介護4" },
                  { value: "要介護5", label: "要介護5" },
                ]}
              />
            </div>
          </Card>

          {/* 在宅5つの呪文 */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">在宅5つの呪文</h3>
            <div className="space-y-4">
              <Select
                label="保険種別"
                value={insuranceType}
                onChange={(val) => setInsuranceType(val)}
                options={[
                  { value: "", label: "選択してください" },
                  { value: "後期高齢者1割", label: "後期高齢者1割" },
                  { value: "後期高齢者2割", label: "後期高齢者2割" },
                  { value: "後期高齢者3割", label: "後期高齢者3割" },
                  { value: "国保", label: "国保" },
                  { value: "社保", label: "社保" },
                  { value: "生保", label: "生保" },
                ]}
              />
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  ADL概要
                </label>
                <Input
                  value={adlDescription}
                  onChange={(e) => setAdlDescription(e.target.value)}
                  placeholder="例: 屋内杖歩行、入浴に介助必要"
                />
              </div>
              <Select
                label="特定疾患"
                value={specialDiseaseFlag}
                onChange={(val) => setSpecialDiseaseFlag(val)}
                options={[
                  { value: "", label: "なし" },
                  { value: "別表7該当", label: "別表7該当" },
                  { value: "別表8該当", label: "別表8該当" },
                ]}
              />
              <TagInput
                label="医療処置"
                value={medicalProcedures}
                onChange={setMedicalProcedures}
                suggestions={MEDICAL_PROCEDURE_SUGGESTIONS}
              />
              <Select
                label="居住場所"
                value={residenceType}
                onChange={(val) => setResidenceType(val)}
                options={[
                  { value: "", label: "選択してください" },
                  { value: "自宅", label: "自宅" },
                  { value: "自宅（独居）", label: "自宅（独居）" },
                  { value: "自宅（家族同居）", label: "自宅（家族同居）" },
                  { value: "グループホーム", label: "グループホーム" },
                  { value: "有料老人ホーム", label: "有料老人ホーム" },
                  { value: "サ高住", label: "サ高住" },
                  { value: "特養", label: "特養" },
                  { value: "その他", label: "その他" },
                ]}
              />
            </div>
          </Card>

          {/* 紹介元・経緯 */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">紹介元・経緯</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  紹介元医療機関名
                </label>
                <Input
                  value={referralInstitution}
                  onChange={(e) => setReferralInstitution(e.target.value)}
                  placeholder="例: ○○総合病院"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">診療科</label>
                  <Input
                    value={referralDepartment}
                    onChange={(e) => setReferralDepartment(e.target.value)}
                    placeholder="例: 呼吸器内科"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">担当医名</label>
                  <Input
                    value={referralDoctor}
                    onChange={(e) => setReferralDoctor(e.target.value)}
                    placeholder="例: 佐藤"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">紹介日</label>
                <Input
                  type="date"
                  value={referralDate}
                  onChange={(e) => setReferralDate(e.target.value)}
                />
              </div>
              <Textarea
                label="訪問診療開始までの経緯"
                value={clinicalBackground}
                onChange={(e) => setClinicalBackground(e.target.value)}
                placeholder="例: COPD急性増悪で入院。退院後の在宅酸素療法管理のため紹介。"
                rows={3}
              />
            </div>
          </Card>

          {/* キーパーソン */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">キーパーソン</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">氏名</label>
                  <Input
                    value={keyPersonName}
                    onChange={(e) => setKeyPersonName(e.target.value)}
                    placeholder="例: 田中花子"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">続柄</label>
                  <Input
                    value={keyPersonRelationship}
                    onChange={(e) => setKeyPersonRelationship(e.target.value)}
                    placeholder="例: 長女"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">電話番号</label>
                <Input
                  value={keyPersonPhone}
                  onChange={(e) => setKeyPersonPhone(e.target.value)}
                  placeholder="例: 090-1234-5678"
                />
              </div>
            </div>
          </Card>

          {/* Status */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">ステータス</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="ステータス"
                value={status}
                onChange={(val) => setStatus(val)}
                options={[
                  { value: "active", label: "アクティブ" },
                  { value: "inactive", label: "非アクティブ" },
                  { value: "discharged", label: "退院済み" },
                ]}
              />
              <Select
                label="リスクレベル"
                value={riskLevel}
                onChange={(val) => setRiskLevel(val)}
                options={[
                  { value: "low", label: "低" },
                  { value: "medium", label: "中" },
                  { value: "high", label: "高" },
                ]}
              />
            </div>
          </Card>

          {/* Submit */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/patients/${id}`)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "変更を保存"
              )}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
