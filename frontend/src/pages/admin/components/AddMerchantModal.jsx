import { X } from "lucide-react";

export default function AddMerchantModal({
  isOpen,
  merchantName,
  merchantEmail,
  merchantPassword,
  merchantError,
  isSubmitting,
  onClose,
  onSubmit,
  onMerchantNameChange,
  onMerchantEmailChange,
  onMerchantPasswordChange,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Onboard Merchant</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-3">
          <input
            className="w-full border p-2 rounded"
            placeholder="Merchant name"
            value={merchantName}
            onChange={(e) => onMerchantNameChange(e.target.value)}
          />
          <input
            className="w-full border p-2 rounded"
            placeholder="merchant@iith.ac.in"
            value={merchantEmail}
            onChange={(e) => onMerchantEmailChange(e.target.value)}
          />
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Temporary password (min 8 chars)"
            value={merchantPassword}
            onChange={(e) => onMerchantPasswordChange(e.target.value)}
          />

          {merchantError ? <p className="text-sm text-red-600">{merchantError}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="border px-4 py-2 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="bg-black text-white px-4 py-2 rounded-lg">
              {isSubmitting ? "Adding..." : "Add Merchant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
