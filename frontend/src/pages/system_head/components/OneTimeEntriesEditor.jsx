import { useRef, useState } from "react";
import { ONE_TIME_CSV_EXAMPLE, parseOneTimeCsv } from "../utils/oneTimeCsv";

export default function OneTimeEntriesEditor({
  rows,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  onImportRows,
}) {
  const fileInputRef = useRef(null);
  const [csvFeedback, setCsvFeedback] = useState({ type: "", message: "" });
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isCsvHelpOpen, setIsCsvHelpOpen] = useState(false);

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const clearUploadedCsv = () => {
    setUploadedFileName("");
    setCsvFeedback({ type: "", message: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const csvText = await file.text();
      const parsedRows = parseOneTimeCsv(csvText);
      onImportRows(parsedRows);
      setUploadedFileName(file.name);
      setCsvFeedback({
        type: "success",
        message: `Imported ${parsedRows.length} row${parsedRows.length > 1 ? "s" : ""} from CSV.`,
      });
    } catch (error) {
      setUploadedFileName("");
      setCsvFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to read CSV file.",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="mt-4 grid gap-4">
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openFilePicker}
            className="rounded-lg border px-3 py-2 text-sm bg-blue-300"
          >
            Upload CSV
          </button>
          {uploadedFileName ? (
            <>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                {uploadedFileName}
              </span>
              <button
                type="button"
                onClick={clearUploadedCsv}
                className="rounded-lg border px-3 py-2 text-sm bg-red-300"
              >
                Remove CSV
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setIsCsvHelpOpen((prev) => !prev)}
            className="rounded-lg border px-3 py-2 text-sm bg-blue-300"
          >
            {isCsvHelpOpen ? "Hide CSV Help" : "CSV Help"}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {csvFeedback.message ? (
          <p className={"mt-2 text-sm " + (csvFeedback.type === "error" ? "text-red-600" : "text-green-700")}>
            {csvFeedback.message}
          </p>
        ) : null}

        {isCsvHelpOpen ? (
          <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-700">
            <p className="font-semibold text-sm">CSV format and rules</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Use headers: sl_no, roll_no, amount (sl_no is optional).</li>
              <li>RollNo and Amount columns are mandatory.</li>
              <li>No blank rows are allowed between data rows.</li>
              <li>Roll numbers must be unique in a single CSV.</li>
              <li>Amount must be a number greater than 0.</li>
            </ul>
            <p className="mt-3 font-medium">Example:</p>
            <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-[11px] border border-gray-200">{ONE_TIME_CSV_EXAMPLE}</pre>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="max-h-105 overflow-y-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="border-b border-gray-200 px-3 py-2">S.No</th>
                <th className="border-b border-gray-200 px-3 py-2">Roll No</th>
                <th className="border-b border-gray-200 px-3 py-2">Amount</th>
                <th className="border-b border-gray-200 px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.rowKey}>
                  <td className="border-b border-gray-200 px-3 py-2">{index + 1}</td>
                  <td className="border-b border-gray-200 px-3 py-2">
                    <input
                      type="text"
                      value={row.rollNo}
                      onChange={(e) => onUpdateRow(row.rowKey, "rollNo", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="CS24BTECH11001"
                    />
                  </td>
                  <td className="border-b border-gray-200 px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => onUpdateRow(row.rowKey, "amount", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </td>
                  <td className="border-b border-gray-200 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row.rowKey)}
                      disabled={rows.length <= 1}
                      className="rounded-lg border px-3 py-1 text-xs  bg-red-300"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={onAddRow}
          className="rounded-lg border px-3 py-2 text-sm bg-green-300"
        >
          Add Roll No
        </button>
      </div>
    </div>
  );
}
