"use client";

import { Card, CardHeader } from "@/components/ui";
import { Building2, FileText, UserCircle } from "lucide-react";
import type { Patient } from "@/lib/api";

interface ReferralCardProps {
  patient: Patient;
  inline?: boolean;
}

export function ReferralCard({ patient, inline }: ReferralCardProps) {
  const referral = patient.referral_source;
  const background = patient.clinical_background;
  const keyPerson = patient.key_person;

  // Don't render if all sections are empty
  const hasReferral =
    referral &&
    (referral.institution_name || referral.doctor_name || referral.department);
  const hasBackground = !!background;
  const hasKeyPerson = keyPerson && (keyPerson.name || keyPerson.phone);

  if (!hasReferral && !hasBackground && !hasKeyPerson) {
    return null;
  }

  const content = (
    <>
      {!inline && <CardHeader title="紹介元・経緯" />}
      {inline && (
        <div className="border-t border-border-light pt-4 mt-4">
          <p className="text-xs font-medium text-text-tertiary mb-3">紹介元・経緯</p>
        </div>
      )}
      <div className="divide-y divide-border-light">
        {/* Referral source */}
        {hasReferral && (
          <div className="pb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Building2 className="w-4 h-4 text-text-tertiary" />
              <span className="text-xs font-medium text-text-tertiary">
                紹介元医療機関
              </span>
            </div>
            <div className="pl-6">
              <p className="text-sm text-text-primary">
                {[
                  referral!.institution_name,
                  referral!.department,
                  referral!.doctor_name && `${referral!.doctor_name}医師`,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </p>
              {referral!.referral_date && (
                <p className="text-xs text-text-secondary mt-0.5">
                  紹介日: {referral!.referral_date}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Clinical background */}
        {hasBackground && (
          <div className={hasReferral ? "py-3" : "pb-3"}>
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="w-4 h-4 text-text-tertiary" />
              <span className="text-xs font-medium text-text-tertiary">
                経緯
              </span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed pl-6">
              {background}
            </p>
          </div>
        )}

        {/* Key person */}
        {hasKeyPerson && (
          <div className={hasReferral || hasBackground ? "pt-3" : ""}>
            <div className="flex items-center gap-2 mb-1.5">
              <UserCircle className="w-4 h-4 text-text-tertiary" />
              <span className="text-xs font-medium text-text-tertiary">
                キーパーソン
              </span>
            </div>
            <div className="pl-6">
              <p className="text-sm text-text-primary">
                {[
                  keyPerson!.name,
                  keyPerson!.relationship && `（${keyPerson!.relationship}）`,
                ]
                  .filter(Boolean)
                  .join("")}
              </p>
              {keyPerson!.phone && (
                <p className="text-xs text-text-secondary mt-0.5">
                  {keyPerson!.phone}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (inline) return content;

  return <Card>{content}</Card>;
}
