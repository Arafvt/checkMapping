import { useMemo, useState } from "react";
import styles from "./App.module.css";
import FileUploader from "./components/FileUploader.jsx";
import ReportTable from "./components/ReportTable.jsx";
import {
  DEFAULT_CONFIG,
  evaluateRow,
  buildReasonStats,
  summarize,
  REASON_LABELS,
} from "./utils/mappingChecker.js";

export default function App() {
  const [rawItems, setRawItems] = useState(null);
  const [rows, setRows] = useState([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");

  const onData = ({ data, filename: fn, error: err }) => {
    if (err) {
      setError(err);
      setRawItems(null);
      setRows([]);
      setFilename("");
      return;
    }
    setError("");
    setFilename(fn || "");
    setRawItems(data);

    // run evaluation
    const evaluated = data.map((item) => evaluateRow(item, DEFAULT_CONFIG));
    setRows(evaluated);
  };
  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const reasonsToRu = (reasonsStr) => {
    const parts = String(reasonsStr || "")
      .split("|")
      .filter(Boolean);
    return parts.map((p) => REASON_LABELS[p] || p).join(" • ");
  };
  const summary = useMemo(() => summarize(rows), [rows]);
  const reasonStats = useMemo(() => buildReasonStats(rows), [rows]);

  const downloadCsv = () => {
    if (!rows?.length) return;

    const headers = ["id", "status", "reason", "title", "matched_csv_title"];

    const esc = (v) => {
      const s = String(v ?? "");
      if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [
      headers.join(";"),
      ...rows.map((r) =>
        [
          r.id,
          r.ok ? "true" : "false",
          r.manual_reason || reasonsToRu(r.reasons),
          r.title,
          r.matched_csv_title || "",
        ]
          .map(esc)
          .join(";"),
      ),
    ];

    // BOM для Excel
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const base = (filename || "report.json").replace(/\.[^.]+$/, "");
    a.download = `${base}_review.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Mapping Checker </div>
          <div className={styles.sub}>
            Загрузи JSON → получи проверку маппинга...
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <FileUploader onData={onData} />
          <button
            className={styles.downloadBtn}
            onClick={downloadCsv}
            disabled={rows.length === 0}
            title={
              rows.length === 0
                ? "Сначала загрузите файл"
                : "Скачать результат CSV"
            }
          >
            Скачать CSV
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {rows.length > 0 && (
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Файл</div>
            <div className={styles.kpiValue}>{filename || "—"}</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Total</div>
            <div className={styles.kpiValue}>{summary.total}</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>OK</div>
            <div className={styles.kpiValue}>{summary.ok}</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>FAIL</div>
            <div className={styles.kpiValue}>{summary.fail}</div>
          </div>
        </div>
      )}

      {rows.length === 0 && !error && (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Нет данных</div>
          <div className={styles.emptyText}>
            Загрузите JSON-файл с массивом объектов. Используются поля{" "}
            <span className={styles.mono}>title</span> и{" "}
            <span className={styles.mono}>matched_csv_title</span>.
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <ReportTable
          rows={rows}
          reasonStats={reasonStats}
          onUpdateRow={updateRow}
        />
      )}

      {/* raw preview if needed */}
      {rawItems && (
        <details className={styles.details}>
          <summary>Показать 1-й объект (debug)</summary>
          <pre className={styles.pre}>
            {JSON.stringify(rawItems[0], null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
