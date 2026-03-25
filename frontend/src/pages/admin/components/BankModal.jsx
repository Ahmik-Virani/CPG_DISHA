import { Plus, Trash2, X } from "lucide-react";

function isNamePair(pair) {
  return String(pair?.key || "").trim().toLowerCase() === "name";
}

export default function BankModal({
  isOpen,
  isEditing,
  bankPairs,
  bankError,
  isSubmitting,
  isDeleting,
  onClose,
  onSubmit,
  onAddPair,
  onUpdatePair,
  onRemovePair,
  onDelete,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">{isEditing ? "Edit Bank" : "Add Bank"}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {bankPairs.map((pair) => (
              <div key={pair.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <input
                  className="w-full border p-2 rounded"
                  placeholder="Key (example: name)"
                  value={pair.key}
                  disabled={isNamePair(pair)}
                  onChange={(e) => onUpdatePair(pair.id, "key", e.target.value)}
                />
                <input
                  className="w-full border p-2 rounded"
                  placeholder={isNamePair(pair) ? "Bank Name (example: ICICI)" : "Value (example: ICICI)"}
                  value={pair.value}
                  onChange={(e) => onUpdatePair(pair.id, "value", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => onRemovePair(pair.id)}
                  disabled={isNamePair(pair)}
                  className="inline-flex items-center justify-center rounded-lg border px-3 py-2"
                  aria-label="Remove key value pair"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={onAddPair} className="rounded-lg border px-3 py-2 text-sm">
            <Plus size={14} className="inline mr-1" /> Add Key-Value Pair
          </button>

          {bankError ? <p className="text-sm text-red-600">{bankError}</p> : null}

          <div className="flex justify-between gap-2 pt-2">
            <div>
              {isEditing ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isDeleting || isSubmitting}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
                >
                  {isDeleting ? "Deleting..." : "Delete Bank"}
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="border px-4 py-2 rounded-lg">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Add Bank"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
