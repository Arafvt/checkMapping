import { useEffect } from "react";
import styles from "./RowDetailsModal.module.css";

function prettyVol(v) {
  if (!v) return "—";
  if (v.kind === "ml") return `${v.value} мл`;
  if (v.kind === "g") return `${v.value} г`;
  return `${v.value}`;
}

function prettyMods(arr) {
  if (!arr || arr.length === 0) return "—";
  return arr.join(", ");
}

function sectionTitle(text) {
  return <div className={styles.sectionTitle}>{text}</div>;
}

function reasonText(reason) {
  const map = {
    BEST_MATCH_NO_MATCH:
      "best_match=no_match (маппинг не найден / не назначен)",
    NO_MATCH_TITLE: "matched_csv_title пустой (сравнивать не с чем)",
    VOLUME_MISSING_ONE_SIDE: "Объём/вес найден только с одной стороны",
    VOLUME_MISMATCH: "Объём/вес не совпал",
    PERCENT_MISSING_ONE_SIDE: "Процент найден только с одной стороны",
    PERCENT_MISMATCH: "Процент не совпал",
    FLAVOR_MISSING_ONE_SIDE: "Вкус найден только с одной стороны",
    FLAVOR_MISMATCH: "Вкус не совпал",
    UNIT_ONLY_MISSING_ONE_SIDE:
      "Единица (кг/шт/уп) указана только с одной стороны",
    UNIT_ONLY_MISMATCH: "Единица (кг/шт/уп) не совпала",
    MODIFIER_MISMATCH:
      "Модификаторы (zero/без сахара/light/безлактозный/…) не совпали",
    CANONICAL_KEY_DIFF:
      "Ключевые слова (canonical key) различаются при совпавших фичах",
  };
  return map[reason] || reason;
}

export default function RowDetailsModal({ row, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!row) return null;

  const d = row.__details;
  const src = d?.source;
  const tgt = d?.target;

  // Differences helpers
  const volMismatch =
    (src?.volumeOrWeight || tgt?.volumeOrWeight) &&
    (!src?.volumeOrWeight ||
      !tgt?.volumeOrWeight ||
      src.volumeOrWeight.kind !== tgt.volumeOrWeight.kind ||
      src.volumeOrWeight.value !== tgt.volumeOrWeight.value);

  const pctMismatch =
    (src?.percent !== null || tgt?.percent !== null) &&
    (src?.percent === null ||
      tgt?.percent === null ||
      src.percent !== tgt.percent);

  const flavorMismatch =
    (src?.flavor !== null || tgt?.flavor !== null) &&
    (src?.flavor === null || tgt?.flavor === null || src.flavor !== tgt.flavor);

  const modsMismatch =
    (src?.modifiers || []).join("|") !== (tgt?.modifiers || []).join("|");

  const keyMismatch = (src?.canonicalKey || "") !== (tgt?.canonicalKey || "");

  return (
    <div
      className={styles.backdrop}
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            Детали маппинга: <span className={styles.mono}>{row.id}</span>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.meta}>
          <div className={styles.metaRow}>
            <span className={styles.label}>Итог:</span>{" "}
            <span className={row.ok ? styles.ok : styles.fail}>
              {row.ok ? "OK" : "FAIL"}
            </span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.label}>feature_ok:</span>{" "}
            {String(row.feature_ok)} •{" "}
            <span className={styles.label}>strict_ok:</span>{" "}
            {String(row.strict_ok)} •{" "}
            <span className={styles.label}>accuracy:</span>{" "}
            <span className={styles.mono}>
              {Number(row.tokenJaccard).toFixed(3)}
            </span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.label}>source:</span>{" "}
            <span className={styles.mono}>{row.source}</span> •{" "}
            <span className={styles.label}>best_match:</span>{" "}
            <span className={styles.mono}>{row.best_match}</span> •{" "}
            <span className={styles.label}>confidence:</span>{" "}
            <span className={styles.mono}>{row.match_confidence}</span>
          </div>
        </div>

        {sectionTitle("Причины (reasons)")}
        <div className={styles.reasons}>
          {(
            row.__reasonsArr ||
            String(row.reasons || "")
              .split("|")
              .filter(Boolean)
          ).map((r) => (
            <div key={r} className={styles.reasonItem}>
              <span className={styles.mono}>{r}</span>
              <span className={styles.reasonText}>{reasonText(r)}</span>
            </div>
          ))}
        </div>

        {sectionTitle("Сравнение признаков")}
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Source</div>
            <div className={styles.cardText}>{row.title || "—"}</div>

            <div className={styles.kv}>
              <span className={styles.k}>Объём/вес</span>
              <span className={`${styles.v} ${volMismatch ? styles.bad : ""}`}>
                {prettyVol(src?.volumeOrWeight)}
              </span>

              <span className={styles.k}>Процент</span>
              <span className={`${styles.v} ${pctMismatch ? styles.bad : ""}`}>
                {src?.percent ?? "—"}
              </span>

              <span className={styles.k}>Вкус</span>
              <span
                className={`${styles.v} ${flavorMismatch ? styles.bad : ""}`}
              >
                {src?.flavor ?? "—"}
              </span>

              <span className={styles.k}>Модификаторы</span>
              <span className={`${styles.v} ${modsMismatch ? styles.bad : ""}`}>
                {prettyMods(src?.modifiers)}
              </span>

              <span className={styles.k}>Canonical key</span>
              <span
                className={`${styles.v} ${keyMismatch ? styles.bad : ""} ${styles.mono}`}
              >
                {src?.canonicalKey || "—"}
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Target</div>
            <div className={styles.cardText}>
              {row.matched_csv_title || "—"}
            </div>

            <div className={styles.kv}>
              <span className={styles.k}>Объём/вес</span>
              <span className={`${styles.v} ${volMismatch ? styles.bad : ""}`}>
                {prettyVol(tgt?.volumeOrWeight)}
              </span>

              <span className={styles.k}>Процент</span>
              <span className={`${styles.v} ${pctMismatch ? styles.bad : ""}`}>
                {tgt?.percent ?? "—"}
              </span>

              <span className={styles.k}>Вкус</span>
              <span
                className={`${styles.v} ${flavorMismatch ? styles.bad : ""}`}
              >
                {tgt?.flavor ?? "—"}
              </span>

              <span className={styles.k}>Модификаторы</span>
              <span className={`${styles.v} ${modsMismatch ? styles.bad : ""}`}>
                {prettyMods(tgt?.modifiers)}
              </span>

              <span className={styles.k}>Canonical key</span>
              <span
                className={`${styles.v} ${keyMismatch ? styles.bad : ""} ${styles.mono}`}
              >
                {tgt?.canonicalKey || "—"}
              </span>
            </div>
          </div>
        </div>

        <details className={styles.details}>
          <summary>Raw JSON (debug)</summary>
          <pre className={styles.pre}>{JSON.stringify(row.__raw, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}
