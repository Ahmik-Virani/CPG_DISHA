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
  onSelectBank,
  onFixedAmountToggle,
  onFixedAmountChange,
  onRecurringModeChange,
  onNextExecutionDateChange,
  onIntervalValueChange,
  onIntervalUnitChange,
  onCancel,
}) {
  const getFormTitle = () => {
    if (paymentType === "one_time") return "One-Time";
    if (paymentType === "fixed") return "Fixed";
    if (paymentType === "recurring") return "Recurring";
    return "Payment";
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 border-t border-gray-100 pt-5 space-y-6">

      {/* ── Form header ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {getFormTitle()} Payment Request
        </p>
        <button
          type="button"
          onClick={onChangeType}
          className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors"
        >
          Change type
        </button>
      </div>

      {/* ── One-time: entries editor ── */}
      {paymentType === "one_time" && (
        <OneTimeEntriesEditor
          rows={paymentForm.oneTimeRows}
          onAddRow={onAddOneTimeRow}
          onRemoveRow={onRemoveOneTimeRow}
          onUpdateRow={onUpdateOneTimeRow}
          onImportRows={onImportOneTimeRows}
        />
      )}

      {/* ── Fixed: amount toggle ── */}
      {paymentType === "fixed" && (
        <div className="space-y-4">
          <label className="inline-flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={paymentForm.isAmountFixed}
              onChange={onFixedAmountToggle}
              className="w-4 h-4 accent-orange-700"
            />
            <span className="text-gray-700 font-medium">Set a fixed amount for all users</span>
          </label>

          {paymentForm.isAmountFixed && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={onFixedAmountChange}
                className="w-full max-w-xs border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-600 transition-colors"
                placeholder="0.00"
                required
              />
            </div>
          )}
        </div>
      )}

      {/* ── Recurring: amount + mode selection ── */}
      {paymentType === "recurring" && (
        <div className="space-y-5">
          {/* Amount field (required for recurring) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fixed Amount (₹) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentForm.amount}
              onChange={onFixedAmountChange}
              className="w-full max-w-xs border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-600 transition-colors"
              placeholder="0.00"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Amount charged each recurring cycle</p>
          </div>

          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Recurrence Mode *</label>
            <div className="space-y-3">
              <label className="inline-flex items-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl cursor-pointer hover:bg-orange-50 transition-colors" 
                style={{ borderColor: paymentForm.recurringMode === "date" ? "#f97316" : "" }}>
                <input
                  type="radio"
                  name="recurringMode"
                  value="date"
                  checked={paymentForm.recurringMode === "date"}
                  onChange={(e) => onRecurringModeChange(e.target.value)}
                  className="w-4 h-4 accent-orange-600"
                />
                <span className="font-medium text-gray-700">Specific Next Date</span>
              </label>

              <label className="inline-flex items-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl cursor-pointer hover:bg-orange-50 transition-colors"
                style={{ borderColor: paymentForm.recurringMode === "interval" ? "#f97316" : "" }}>
                <input
                  type="radio"
                  name="recurringMode"
                  value="interval"
                  checked={paymentForm.recurringMode === "interval"}
                  onChange={(e) => onRecurringModeChange(e.target.value)}
                  className="w-4 h-4 accent-orange-600"
                />
                <span className="font-medium text-gray-700">Interval Based</span>
              </label>
            </div>
          </div>

          {/* Date Mode: Next Execution Date */}
          {paymentForm.recurringMode === "date" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Next Execution Date *</label>
              <input
                type="date"
                value={paymentForm.nextExecutionDate}
                onChange={(e) => onNextExecutionDateChange(e.target.value)}
                className="w-full max-w-xs border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-600 transition-colors"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Payment will start on this date</p>
            </div>
          )}

          {/* Interval Mode: Value and Unit */}
          {paymentForm.recurringMode === "interval" && (
            <div className="grid gap-4 grid-cols-2 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Interval Value *</label>
                <input
                  type="number"
                  min="1"
                  value={paymentForm.intervalValue}
                  onChange={(e) => onIntervalValueChange(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-600 transition-colors"
                  placeholder="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Interval Unit *</label>
                <select
                  value={paymentForm.intervalUnit}
                  onChange={(e) => onIntervalUnitChange(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-600 transition-colors"
                  required
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Settings row: TTL + Banks ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {paymentType === "one_time" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Deadline</label>
            <input
              type="datetime-local"
              value={paymentForm.timeToLive}
              onChange={(e) => onTimeToLiveChange(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-600 transition-colors"
              required
            />
          </div>
        )}

        <div className={paymentType === "one_time" ? "" : "md:col-span-2"}>
          <p className="text-sm font-medium text-gray-700 mb-2">Banks</p>
          {bankOptions.length ? (
            <div className="flex flex-wrap gap-2">
              {bankOptions.map((bank) => {
                const isSelected = Array.isArray(paymentForm.banks) && paymentForm.banks.includes(bank);
                return (
                  <button
                    key={bank}
                    type="button"
                    onClick={() => onSelectBank(bank)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                      isSelected
                        ? "bg-orange-400 border-orange-400 text-white shadow-sm"
                        : "bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:bg-orange-50"
                    }`}
                  >
                    {bank}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-amber-700">No banks configured. Please contact admin.</p>
          )}
        </div>
      </div>

      {/* ── Feedback ── */}
      {paymentFeedback.message && (
        <p className={"text-sm " + (paymentFeedback.type === "error" ? "text-red-600" : "text-green-700")}>
          {paymentFeedback.message}
        </p>
      )}

      {/* ── Submit / Cancel ── */}
      <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
        <button
          type="submit"
          disabled={isActing}
          className="px-5 py-2.5 rounded-xl bg-orange-400 text-white text-sm font-medium hover:bg-orange-500 shadow-sm transition-colors disabled:opacity-60"
        >
          {isActing ? "Submitting..." : "Submit Request"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
