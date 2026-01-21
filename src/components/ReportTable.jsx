// src/components/ReportTable.jsx
import { useMemo, useState, useEffect } from "react";
import styles from "./ReportTable.module.css";
import RowDetailsModal from "./RowDetailsModal.jsx";
import { REASON_LABELS } from "../utils/mappingChecker.js";

const PAGE_SIZE = 100;

function pillClass(ok) {
  return ok ? `${styles.pill} ${styles.ok}` : `${styles.pill} ${styles.fail}`;
}

function humanizeReasons(reasonsStr) {
  const parts = String(reasonsStr || "")
    .split("|")
    .filter(Boolean);
  return parts.map((p) => REASON_LABELS[p] || p).join(" • ");
}

export default function ReportTable({ rows, reasonStats, onUpdateRow }) {
  const [selectedRow, setSelectedRow] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("fail_first");
  const [showAllReasons, setShowAllReasons] = useState(false);
  const [page, setPage] = useState(1);

  const topReasons = useMemo(() => {
    const arr = Object.entries(reasonStats || {}).sort((a, b) => b[1] - a[1]);
    return showAllReasons ? arr : arr.slice(0, 3);
  }, [reasonStats, showAllReasons]);

  const filteredSorted = useMemo(() => {
    const query = q.trim().toLowerCase();

    let arr = rows;

    // filter
    arr = arr.filter((r) => {
      if (filter === "all") return true;
      if (filter === "fail") return !r.ok;
      if (filter === "ok") return r.ok;
      if (filter === "feature_ok") return r.feature_ok;
      if (filter === "strict_ok") return r.strict_ok;
      if (filter === "no_match") {
        return (
          r.best_match === "no_match" ||
          String(r.reasons || "").includes("NO_MATCH_TITLE") ||
          String(r.reasons || "").includes("BEST_MATCH_NO_MATCH")
        );
      }
      return true;
    });

    // search
    if (query) {
      arr = arr.filter((r) => {
        const hay = [
          r.id,
          r.source,
          r.best_match,
          r.matched_uuid,
          r.title,
          r.matched_csv_title,
          r.reasons,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
    }

    // sort
    const sorted = [...arr];
    if (sort === "fail_first")
      sorted.sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? 1 : -1));
    if (sort === "ok_first")
      sorted.sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? -1 : 1));
    if (sort === "jaccard_desc")
      sorted.sort((a, b) => b.tokenJaccard - a.tokenJaccard);
    if (sort === "jaccard_asc")
      sorted.sort((a, b) => a.tokenJaccard - b.tokenJaccard);

    return sorted;
  }, [rows, q, filter, sort]);

  // Reset page when filters/search/sort change
  useEffect(() => {
    setPage(1);
  }, [q, filter, sort]);

  const totalRows = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  const safePage = Math.min(Math.max(page, 1), totalPages);

  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const shown = filteredSorted.slice(pageStart, pageEnd);

  const goFirst = () => setPage(1);
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const goLast = () => setPage(totalPages);

  // Compact pages around current (e.g., 1 ... 7 8 9 ... 20)
  const pageButtons = useMemo(() => {
    const buttons = [];
    const window = 2;

    const add = (x) => buttons.push(x);

    add(1);

    const start = Math.max(2, safePage - window);
    const end = Math.min(totalPages - 1, safePage + window);

    if (start > 2) add("…");

    for (let p = start; p <= end; p++) add(p);

    if (end < totalPages - 1) add("…");

    if (totalPages > 1) add(totalPages);

    // de-dup adjacent
    return buttons.filter((v, i) => i === 0 || v !== buttons[i - 1]);
  }, [safePage, totalPages]);

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <input
          className={styles.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по title / matched / id / причина..."
        />
        <select
          className={styles.select}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Все</option>
          <option value="fail">Только FAIL</option>
          <option value="ok">Только OK</option>
          <option value="feature_ok">Feature OK</option>
          <option value="strict_ok">Strict OK</option>
          <option value="no_match">Без мапа</option>
        </select>
        <select
          className={styles.select}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="ok_first">Сначала True</option>
          <option value="fail_first">Сначала False</option>
          <option value="jaccard_desc">Accuracy ↓</option>
          <option value="jaccard_asc">Accuracy ↑</option>
        </select>
      </div>

      <div className={styles.topReasons}>
        <div className={styles.topReasonsHeader}>
          <div className={styles.topReasonsTitle}>Top reasons</div>
          <button
            className={styles.topReasonsBtn}
            onClick={() => setShowAllReasons((v) => !v)}
            type="button"
          >
            {showAllReasons ? "Свернуть" : "Показать полностью"}
          </button>
        </div>

        <div className={styles.topReasonsGrid}>
          {topReasons.map(([reason, count]) => (
            <div key={reason} className={styles.reasonRow}>
              <span>{REASON_LABELS[reason] || reason}</span>
              <span className={styles.count}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination header */}
      <div className={styles.pagerBar}>
        <div className={styles.pagerInfo}>
          Строк: <span className={styles.mono}>{totalRows}</span> • Страница{" "}
          <span className={styles.mono}>{safePage}</span> из{" "}
          <span className={styles.mono}>{totalPages}</span> • Показано{" "}
          <span className={styles.mono}>{shown.length}</span> (по {PAGE_SIZE})
        </div>

        <div className={styles.pager}>
          <button
            className={styles.pagerBtn}
            onClick={goFirst}
            disabled={safePage === 1}
          >
            « Первая
          </button>
          <button
            className={styles.pagerBtn}
            onClick={goPrev}
            disabled={safePage === 1}
          >
            ‹ Назад
          </button>

          <div className={styles.pageNums}>
            {pageButtons.map((p, idx) =>
              p === "…" ? (
                <span key={`dots-${idx}`} className={styles.dots}>
                  …
                </span>
              ) : (
                <button
                  key={p}
                  className={`${styles.pageBtn} ${p === safePage ? styles.pageBtnActive : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ),
            )}
          </div>

          <button
            className={styles.pagerBtn}
            onClick={goNext}
            disabled={safePage === totalPages}
          >
            Вперёд ›
          </button>
          <button
            className={styles.pagerBtn}
            onClick={goLast}
            disabled={safePage === totalPages}
          >
            Последняя »
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ok</th>
              <th>reasons</th>
              <th>id</th>
              <th>matched_uuid</th>
              <th>title</th>
              <th>matched_csv_title</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, idx) => (
              <tr
                key={`${r.id}-${pageStart + idx}`}
                className={styles.clickableRow}
                onClick={() => setSelectedRow(r)}
              >
                <td>
                  <span className={pillClass(r.ok)}>
                    {r.ok ? "True" : "False"}
                  </span>
                </td>
                <td>{humanizeReasons(r.reasons)}</td>
                <td className={styles.mono}>{r.id}</td>
                <td className={styles.mono}>{r.matched_uuid}</td>
                <td>{r.title}</td>
                <td>{r.matched_csv_title}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {selectedRow && (
          <RowDetailsModal
            row={selectedRow}
            onClose={() => setSelectedRow(null)}
            onUpdateRow={onUpdateRow}
          />
        )}
      </div>

      {/* Pagination footer (same controls) */}
      <div className={styles.pagerBarBottom}>
        <div className={styles.pager}>
          <button
            className={styles.pagerBtn}
            onClick={goFirst}
            disabled={safePage === 1}
          >
            « Первая
          </button>
          <button
            className={styles.pagerBtn}
            onClick={goPrev}
            disabled={safePage === 1}
          >
            ‹ Назад
          </button>
          <div className={styles.pageNums}>
            {pageButtons.map((p, idx) =>
              p === "…" ? (
                <span key={`dots2-${idx}`} className={styles.dots}>
                  …
                </span>
              ) : (
                <button
                  key={`b-${p}`}
                  className={`${styles.pageBtn} ${p === safePage ? styles.pageBtnActive : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ),
            )}
          </div>
          <button
            className={styles.pagerBtn}
            onClick={goNext}
            disabled={safePage === totalPages}
          >
            Вперёд ›
          </button>
          <button
            className={styles.pagerBtn}
            onClick={goLast}
            disabled={safePage === totalPages}
          >
            Последняя »
          </button>
        </div>
      </div>
    </div>
  );
}
