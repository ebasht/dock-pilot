"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { DeploymentLog } from "@/lib/types";

export function DeploymentLogStream({
  deploymentId,
  initialStatus,
}: {
  deploymentId: string;
  initialStatus?: string;
}) {
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [status, setStatus] = useState(initialStatus ?? "pending");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = api.streamDeploymentLogs(deploymentId);

    es.addEventListener("log", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as DeploymentLog;
        setLogs((prev) => {
          if (prev.some((l) => l.id === data.id)) return prev;
          return [...prev, data];
        });
      } catch {
        /* ignore parse errors */
      }
    });

    es.addEventListener("done", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { status: string };
        setStatus(data.status);
      } catch {
        /* ignore */
      }
      es.close();
    });

    es.onerror = () => es.close();

    return () => es.close();
  }, [deploymentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div>
      <p style={{ marginBottom: "0.75rem" }}>
        Status: <strong>{status}</strong>
      </p>
      <div className="log-viewer">
        {logs.length === 0 && (
          <span style={{ color: "var(--muted)" }}>Waiting for logs…</span>
        )}
        {logs.map((log) => (
          <div key={log.id} className={`log-line-${log.level}`}>
            [{new Date(log.created_at).toLocaleTimeString()}] {log.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
