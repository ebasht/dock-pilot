"use client";

import type { EnvVar } from "@/lib/types";
import { useI18n } from "@/lib/i18n/context";

type Props = {
  rows: EnvVar[];
  onChange: (rows: EnvVar[]) => void;
  valueInputType?: "text" | "password";
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  showRemove?: boolean;
};

export function KeyValueEditor({
  rows,
  onChange,
  valueInputType = "text",
  keyPlaceholder = "NAME",
  valuePlaceholder = "value",
  addLabel,
  showRemove = true,
}: Props) {
  const { t } = useI18n();
  const resolvedAddLabel = addLabel ?? t("kvEditor.addRow");

  const setAt = (index: number, patch: Partial<EnvVar>) => {
    const next = [...rows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="kv-editor">
      <table className="kv-editor-table">
        <colgroup>
          <col className="kv-col-name" />
          <col className="kv-col-value" />
          {showRemove && <col className="kv-col-action" />}
        </colgroup>
        <thead>
          <tr>
            <th>{t("kvEditor.name")}</th>
            <th>{t("kvEditor.value")}</th>
            {showRemove && <th aria-label={t("common.actions")} />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showRemove ? 3 : 2} style={{ color: "var(--muted)" }}>
                {t("kvEditor.empty", { addLabel: resolvedAddLabel })}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={`kv-${i}-${row.key || "new"}`}>
                <td>
                  <input
                    className="input"
                    placeholder={keyPlaceholder}
                    value={row.key}
                    onChange={(e) => setAt(i, { key: e.target.value })}
                    autoComplete="off"
                    aria-label={t("kvEditor.nameN", { n: i + 1 })}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type={valueInputType}
                    placeholder={valuePlaceholder}
                    value={row.value}
                    onChange={(e) => setAt(i, { value: e.target.value })}
                    autoComplete="off"
                    aria-label={t("kvEditor.valueN", { n: i + 1 })}
                  />
                </td>
                {showRemove && (
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary kv-remove"
                      onClick={() => removeAt(i)}
                      aria-label={t("kvEditor.removeRow", { n: i + 1 })}
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onChange([...rows, { key: "", value: "" }])}
      >
        {resolvedAddLabel}
      </button>
    </div>
  );
}
