export default function PaymentTypeChooser({ onChoosePaymentType, onCancel }) {
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-700">Choose request type</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onChoosePaymentType("one_time")}
          className="rounded-lg border bg-white px-4 py-2"
        >
          One-Time
        </button>
        <button
          type="button"
          onClick={() => onChoosePaymentType("fixed")}
          className="rounded-lg border bg-white px-4 py-2"
        >
          Fixed
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
