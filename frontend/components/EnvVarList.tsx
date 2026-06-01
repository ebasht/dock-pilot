"use client";

import { KeyValueEditor } from "@/components/KeyValueEditor";
import type { EnvVar } from "@/lib/types";

type Props = {
  envVars: EnvVar[];
  onChange: (next: EnvVar[]) => void;
};

export function EnvVarList({ envVars, onChange }: Props) {
  return (
    <KeyValueEditor
      rows={envVars}
      onChange={onChange}
      valueInputType="text"
      keyPlaceholder="PORT"
      valuePlaceholder="3000"
      addLabel="Add env var"
    />
  );
}
