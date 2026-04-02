import { Plus, Trash2, X, Key, Tag } from "lucide-react";

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
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-t-2xl">
          <h3 className="text-lg font-semibold">{isEditing ? "Edit Bank" : "Add Bank"}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/20 transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {bankPairs.map((pair) => (
              <div key={pair.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Key</label>
                  <div className="relative">
                    <Key size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      className="w-full border border-gray-300 pl-9 pr-3 py-3 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="example: name"
                      value={pair.key}
                      disabled={isNamePair(pair)}
                      onChange={(e) => onUpdatePair(pair.id, "key", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Value</label>
                  <div className="relative">
                    <Tag size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      className="w-full border border-gray-300 pl-9 pr-3 py-3 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors"
                      placeholder={isNamePair(pair) ? "Bank Name (example: ICICI)" : "Value (example: ICICI)"}
                      value={pair.value}
                      onChange={(e) => onUpdatePair(pair.id, "value", e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemovePair(pair.id)}
                  disabled={isNamePair(pair)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-3 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Remove key value pair"
                >
                  <Trash2 size={14} className="text-gray-500 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>

          <button 
            type="button" 
            onClick={onAddPair} 
            className="w-full border-2 border-dashed border-orange-300 text-orange-600 px-4 py-3 rounded-lg hover:bg-orange-50 hover:border-orange-400 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add Key-Value Pair
          </button>

          {bankError ? <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{bankError}</p> : null}

          <div className="flex justify-between gap-3 pt-4 border-t">
            <div>
              {isEditing ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isDeleting || isSubmitting}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? "Deleting..." : "Delete Bank"}
                </button>
              ) : null}
            </div>
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-6 py-2 rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
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
