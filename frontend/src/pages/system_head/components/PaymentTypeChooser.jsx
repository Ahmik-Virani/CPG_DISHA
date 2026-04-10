export default function PaymentTypeChooser({ onChoosePaymentType, onCancel }) {
  return (
    <div className="mt-4 border-t border-gray-100 pt-5">
      <p className="text-sm font-semibold text-gray-700 mb-3">Choose payment request type</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onChoosePaymentType("one_time")}
          className="px-5 py-2.5 rounded-xl border-2 border-orange-400 bg-orange-400 text-white text-sm font-medium hover:bg-orange-500 transition-colors"
        >
          One-Time
        </button>
        <button
          type="button"
          onClick={() => onChoosePaymentType("fixed")}
          className="px-5 py-2.5 rounded-xl border-2 border-orange-400 bg-orange-400 text-white text-sm font-medium hover:bg-orange-500 transition-colors"
        >
          Fixed
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}