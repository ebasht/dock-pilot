"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ContainerLogLine } from "@/lib/types";

export function ContainerLogStream({ siteId }: { siteId: string }) {
  const [logs, setLogs] = useState<ContainerLogLine[]>([]);
  const [meta, setMeta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs([]);
    setMeta(null);
    setError(null);

    const es = api.streamSiteContainerLogs(siteId);

    es.addEventListener("meta", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          container?: string;
          state?: string;
        };
        if (data.container) {
          setMeta(`${data.container} (${data.state || "—"})`);
        }
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("log", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as ContainerLogLine;
        setLogs((prev) => {
          if (prev.some((l) => l.seq === data.seq)) return prev;
          return [...prev, data];
        });
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("notice", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { message?: string };
        setError(data.message || "No container logs");
      } catch {
        setError("No container logs");
      }
      es.close();
    });

    es.onerror = () => es.close();

    return () => es.close();
  }, [siteId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div>
      {meta && (
        <p style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.8rem" }}>
          Container: {meta}
        </p>
      )}
      {error && (
        <p style={{ margin: "0 0 0.5rem", color: "var(--warning)", fontSize: "0.875rem" }}>
          {error}
        </p>
      )}
      <div className="log-viewer">
        {logs.length === 0 && !error && (
          <span style={{ color: "var(--muted)" }}>Waiting for container output…</span>
        )}
        {logs.map((log) => (
          <div
            key={log.seq}
            className={log.stream === "stderr" ? "log-line-error" : "log-line-info"}
          >
            {log.line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
