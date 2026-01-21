import styles from "./FileUploader.module.css";

export default function FileUploader({ onData }) {
  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      onData({ error: "Файл не является валидным JSON (JSON.parse упал)." });
      return;
    }

    if (!Array.isArray(data)) {
      onData({ error: "Ожидается JSON-массив объектов: [ {...}, {...} ]" });
      return;
    }

    onData({ data, filename: file.name });
  };

  return (
    <div className={styles.wrap}>
      <label className={styles.btn}>
        Загрузить JSON
        <input className={styles.input} type="file" accept=".json,application/json" onChange={onPick} />
      </label>
      <div className={styles.hint}>
        Формат: массив объектов. Используются поля <span className={styles.mono}>title</span> и{" "}
        <span className={styles.mono}>matched_csv_title</span>.
      </div>
    </div>
  );
}
