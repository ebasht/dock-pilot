"use client";

import type { EnvVar } from "@/lib/types";

type Props = {
  rows: EnvVar[];
  onChange: (rows: EnvVar[]) => void;
  /** password for secrets, text for env vars */
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
  addLabel = "Add row",
  showRemove = true,
}: Props) {
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
            <th>Name</th>
            <th>Value</th>
            {showRemove && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showRemove ? 3 : 2} style={{ color: "var(--muted)" }}>
                No entries — click &quot;{addLabel}&quot; below.
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
                    aria-label={`Name ${i + 1}`}
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
                    aria-label={`Value ${i + 1}`}
                  />
                </td>
                {showRemove && (
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary kv-remove"
                      onClick={() => removeAt(i)}
                      aria-label={`Remove row ${i + 1}`}
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
        {addLabel}
      </button>
    </div>
  );
}
