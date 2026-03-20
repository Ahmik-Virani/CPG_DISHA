import OneTimeEntriesEditor from "./OneTimeEntriesEditor";

export default function PaymentRequestForm({
  paymentType,
  paymentForm,
  isActing,
  paymentFeedback,
  bankOptions,
  onSubmit,
  onChangeType,
  onAddOneTimeRow,
  onRemoveOneTimeRow,
  onUpdateOneTimeRow,
  onImportOneTimeRows,
  onTimeToLiveChange,
  onToggleBank,
  onFixedAmountToggle,
  onFixedAmountChange,
  onCancel,
}) {
  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-700">
          Create {paymentType === "one_time" ? "One-Time" : "Fixed"} Payment Request
        </p>
        <button
          type="button"
          onClick={onChangeType}
          className="rounded-lg border px-3 py-1 text-sm"
        >
          Change Type
        </button>
      </div>

      {paymentType === "one_time" ? (
        <>
          <OneTimeEntriesEditor
            rows={paymentForm.oneTimeRows}
            onAddRow={onAddOneTimeRow}
            onRemoveRow={onRemoveOneTimeRow}
            onUpdateRow={onUpdateOneTimeRow}
            onImportRows={onImportOneTimeRows}
          />

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">Time To Live</span>
                <input
                  type="datetime-local"
                  value={paymentForm.timeToLive}
                  onChange={(e) => onTimeToLiveChange(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  required
                />
              </label>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-medium text-gray-700">Banks</p>
              <div className="mt-2 flex flex-wrap gap-4">
                {bankOptions.map((bank) => (
                  <label key={bank} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={paymentForm.banks.includes(bank)}
                      onChange={() => onToggleBank(bank)}
                    />
                    {bank}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {paymentType === "fixed" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={paymentForm.isAmountFixed}
              onChange={onFixedAmountToggle}
            />
            Fix amount for this request
          </label>

          {paymentForm.isAmountFixed ? (
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={onFixedAmountChange}
                className="rounded-lg border px-3 py-2"
                required
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {paymentType !== "one_time" ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-700">Banks</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {bankOptions.map((bank) => (
              <label key={bank} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={paymentForm.banks.includes(bank)}
                  onChange={() => onToggleBank(bank)}
                />
                {bank}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {paymentFeedback.message ? (
        <p className={"mt-4 text-sm " + (paymentFeedback.type === "error" ? "text-red-600" : "text-green-700")}>
          {paymentFeedback.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={isActing} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-60">
          {isActing ? "Submitting..." : "Submit Request"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
