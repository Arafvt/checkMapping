import { useMemo, useState } from "react";
import styles from "./App.module.css";

import FileUploader from "./components/FileUploader.jsx";
import ReportTable from "./components/ReportTable.jsx";
import { DEFAULT_CONFIG, evaluateRow, buildReasonStats, summarize } from "./utils/mappingChecker.js";

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

  const summary = useMemo(() => summarize(rows), [rows]);
  const reasonStats = useMemo(() => buildReasonStats(rows), [rows]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Mapping Checker Dashboard</div>
          <div className={styles.sub}>
            Загрузи JSON → получи проверку маппинга по строгим правилам (объем/%/вкус/модификаторы + canonical key).
          </div>
        </div>
        <FileUploader onData={onData} />
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
            Загрузите JSON-файл с массивом объектов. Используются поля <span className={styles.mono}>title</span> и{" "}
            <span className={styles.mono}>matched_csv_title</span>.
          </div>
        </div>
      )}

      {rows.length > 0 && <ReportTable rows={rows} reasonStats={reasonStats} />}

      {/* raw preview if needed */}
      {rawItems && (
        <details className={styles.details}>
          <summary>Показать 1-й объект (debug)</summary>
          <pre className={styles.pre}>{JSON.stringify(rawItems[0], null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
