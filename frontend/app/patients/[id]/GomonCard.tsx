"use client";

import { Card, CardHeader, Badge } from "@/components/ui";
import { Calendar, Stethoscope, Activity, Syringe, Home } from "lucide-react";
import type { Patient } from "@/lib/api";

interface GomonCardProps {
  patient: Patient;
  inline?: boolean;
}

const GOMON_ITEMS = [
  {
    key: "age",
    label: "① 年齢",
    icon: Calendar,
  },
  {
    key: "diagnosis",
    label: "② 主病名",
    icon: Stethoscope,
  },
  {
    key: "adl",
    label: "③ ADL",
    icon: Activity,
  },
  {
    key: "procedures",
    label: "④ 医療処置",
    icon: Syringe,
  },
  {
    key: "residence",
    label: "⑤ 居住場所",
    icon: Home,
  },
] as const;

export function GomonCard({ patient, inline }: GomonCardProps) {
  // Build display values from patient data (existing + new fields)
  const ageDisplay = patient.age ? `${patient.age}歳` : null;
  const insuranceDisplay = patient.insurance_type || null;

  const diagnosisDisplay = patient.primary_diagnosis || null;
  const specialDiseaseDisplay = patient.special_disease_flag || null;

  const adlDisplay = patient.care_level || null;
  const adlDescDisplay = patient.adl_description || null;

  const proceduresDisplay =
    patient.medical_procedures && patient.medical_procedures.length > 0
      ? patient.medical_procedures.join(", ")
      : null;

  const residenceDisplay = patient.residence_type || null;

  const items = [
    {
      ...GOMON_ITEMS[0],
      value: ageDisplay,
      subValue: insuranceDisplay,
    },
    {
      ...GOMON_ITEMS[1],
      value: diagnosisDisplay,
      subValue: specialDiseaseDisplay,
      isBadge: !!specialDiseaseDisplay,
    },
    {
      ...GOMON_ITEMS[2],
      value: adlDisplay,
      subValue: adlDescDisplay,
    },
    {
      ...GOMON_ITEMS[3],
      value: proceduresDisplay,
      subValue: null,
    },
    {
      ...GOMON_ITEMS[4],
      value: residenceDisplay,
      subValue: null,
    },
  ];

  const content = (
    <>
      {!inline && <CardHeader title="在宅5つの呪文" description="訪問前クイックチェック" />}
      {inline && (
        <div className="border-t border-border-light pt-4 mt-4">
          <p className="text-xs font-medium text-text-tertiary mb-3">在宅5つの呪文</p>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="rounded-lg border border-border-light bg-bg-secondary/50 p-3"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-accent-500 flex-shrink-0" />
                <span className="text-xs text-text-tertiary font-medium">
                  {item.label}
                </span>
              </div>
              {item.value ? (
                <div>
                  <p className="text-sm font-medium text-text-primary leading-snug">
                    {item.value}
                  </p>
                  {item.subValue && (
                    "isBadge" in item && item.isBadge ? (
                      <Badge variant="warning" size="sm">
                        {item.subValue}
                      </Badge>
                    ) : (
                      <p className="text-xs text-text-secondary mt-0.5">
                        {item.subValue}
                      </p>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">未登録</p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  if (inline) return content;

  return <Card>{content}</Card>;
}
