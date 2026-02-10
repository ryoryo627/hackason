"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Input, Alert, Select, Textarea, TagInput } from "@/components/ui";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import {
  patientsApi,
  settingsApi,
  setupApi,
  type CreatePatientData,
  type Facility,
  type Area,
} from "@/lib/api";

interface SlackUser {
  id: string;
  name: string;
  email: string;
  display_name: string;
}

const MEDICAL_PROCEDURE_SUGGESTIONS = [
  "HOT", "吸入", "CV管理", "PEG", "バルーン", "褥瘡処置",
  "IVH", "気管切開", "人工呼吸器", "在宅自己注射", "ストーマ", "インスリン",
];

export default function NewPatientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    patient_id: string;
    slack?: {
      channel_created: boolean;
      channel_name?: string;
      error?: string;
    };
  } | null>(null);

  // Master data
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  // Form state
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
  const [createSlackChannel, setCreateSlackChannel] = useState(true);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);

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

  // Load master data on mount
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [facilitiesRes, areasRes] = await Promise.all([
          settingsApi.listFacilities().catch(() => ({ facilities: [], total: 0 })),
          settingsApi.listAreas().catch(() => ({ areas: [], total: 0 })),
        ]);
        setFacilities(facilitiesRes.facilities);
        setAreas(areasRes.areas);

        // Load Slack users (may fail if Slack not configured)
        try {
          const slackRes = await setupApi.listSlackUsers();
          setSlackUsers(slackRes.users);
        } catch {
          // Slack not configured - that's fine
        }
      } catch (err) {
        console.error("Failed to load master data:", err);
      } finally {
        setLoadingMaster(false);
      }
    }
    loadMasterData();
  }, []);

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

      const data: CreatePatientData = {
        name: name.trim(),
        ...(nameKana && { name_kana: nameKana.trim() }),
        ...(birthDate && { birth_date: birthDate }),
        ...(gender && { gender }),
        ...(address && { address: address.trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(primaryDiagnosis && { primary_diagnosis: primaryDiagnosis.trim() }),
        ...(facility && { facility }),
        ...(area && { area }),
        ...(careLevel && { care_level: careLevel }),
        create_slack_channel: createSlackChannel,
        ...(selectedTeamMembers.length > 0 && {
          team_member_ids: selectedTeamMembers,
        }),
        // 5つの呪文
        ...(insuranceType && { insurance_type: insuranceType }),
        ...(adlDescription.trim() && { adl_description: adlDescription.trim() }),
        ...(specialDiseaseFlag && { special_disease_flag: specialDiseaseFlag }),
        ...(medicalProcedures.length > 0 && { medical_procedures: medicalProcedures }),
        ...(residenceType && { residence_type: residenceType }),
        // 紹介元・経緯
        ...(referralSource && { referral_source: referralSource }),
        ...(clinicalBackground.trim() && { clinical_background: clinicalBackground.trim() }),
        ...(keyPerson && { key_person: keyPerson }),
      };

      const result = await patientsApi.create(data);
      setSuccess({
        patient_id: result.patient_id,
        slack: result.slack,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "患者の登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const toggleTeamMember = (userId: string) => {
    setSelectedTeamMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Success screen
  if (success) {
    return (
      <AdminLayout title="患者登録完了">
        <Card className="max-w-lg mx-auto text-center py-8">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">
            患者を登録しました
          </h2>
          <p className="text-text-secondary mb-4">
            患者ID: {success.patient_id}
          </p>
          {success.slack?.channel_created && (
            <p className="text-sm text-success mb-4">
              Slackチャンネル #{success.slack.channel_name} を作成しました
            </p>
          )}
          {success.slack && !success.slack.channel_created && success.slack.error && (
            <p className="text-sm text-warning mb-4">
              Slackチャンネルの作成に失敗しました: {success.slack.error}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => router.push("/patients")}>
              患者一覧に戻る
            </Button>
            <Button onClick={() => router.push(`/patients/${success.patient_id}`)}>
              患者詳細を表示
            </Button>
          </div>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="患者登録">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Button variant="ghost" size="sm" onClick={() => router.push("/patients")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          患者一覧に戻る
        </Button>

        {/* Error */}
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)} className="mb-6">{error}</Alert>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">基本情報</h3>
            <div className="space-y-4">
              {/* Name (required) */}
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

              {/* Name Kana */}
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

              {/* Birth Date & Gender */}
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

              {/* Address & Phone */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  住所
                </label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="例: 東京都新宿区..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  電話番号
                </label>
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
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  主病名
                </label>
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

          {/* Slack Settings */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Slack連携
            </h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createSlackChannel}
                  onChange={(e) => setCreateSlackChannel(e.target.checked)}
                  className="w-4 h-4 text-accent-600 border-border-strong rounded focus:ring-accent-500"
                />
                <span className="text-sm text-text-secondary">
                  Slackチャンネルを自動作成する
                </span>
              </label>

              {createSlackChannel && slackUsers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    チームメンバー（チャンネルに招待）
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border-light">
                    {slackUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-bg-secondary cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeamMembers.includes(user.id)}
                          onChange={() => toggleTeamMember(user.id)}
                          className="w-4 h-4 text-accent-600 border-border-strong rounded focus:ring-accent-500"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {user.display_name || user.name}
                          </p>
                          {user.email && (
                            <p className="text-xs text-text-secondary truncate">
                              {user.email}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedTeamMembers.length > 0 && (
                    <p className="text-xs text-text-secondary mt-1">
                      {selectedTeamMembers.length}名選択中
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Submit */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/patients")}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  登録中...
                </>
              ) : (
                "患者を登録"
              )}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
