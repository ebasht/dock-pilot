"use client";

import { KeyValueEditor } from "@/components/KeyValueEditor";
import type { EnvVar } from "@/lib/types";
import { useI18n } from "@/lib/i18n/context";

type Props = {
  envVars: EnvVar[];
  onChange: (next: EnvVar[]) => void;
};

export function EnvVarList({ envVars, onChange }: Props) {
  const { t } = useI18n();

  return (
    <KeyValueEditor
      rows={envVars}
      onChange={onChange}
      valueInputType="text"
      keyPlaceholder="PORT"
      valuePlaceholder="3000"
      addLabel={t("kvEditor.addEnvVar")}
    />
  );
}
