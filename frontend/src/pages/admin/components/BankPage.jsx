import { Plus, Edit3, Power, Building2 } from "lucide-react";

export default function BankPage({
  banks,
  isLoading,
  error,
  onOpenAddBank,
  onOpenEditBank,
  onToggleBankStatus,
}) {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Manage Banks</h2>
          <p className="text-sm text-gray-500">Create and maintain bank records used in payment requests.</p>
        </div>

        <button
          onClick={onOpenAddBank}
          className="bg-orange-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-orange-500 transition-colors duration-300"
        >
          <Plus size={16} /> Add Bank
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {isLoading ? (
        <div className="text-center text-gray-500">Loading banks...</div>
      ) : banks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banks.map((bank) => (
            <div
              key={bank.id}
              className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-orange-200 transition-all duration-300 group"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 p-2 rounded-lg group-hover:bg-orange-200 transition-colors">
                    <Building2 size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">{bank.displayName}</h3>
                    <p
                      className={
                        "mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium " +
                        (bank.enabled === false 
                          ? "bg-red-100 text-red-700" 
                          : "bg-green-100 text-green-700")
                      }
                    >
                      <div className={`w-2 h-2 rounded-full ${bank.enabled === false ? 'bg-red-500' : 'bg-green-500'}`}></div>
                      {bank.enabled === false ? "Disabled" : "Enabled"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleBankStatus(bank)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-200 hover:shadow-sm " +
                    (bank.enabled === false
                      ? "border-green-600 text-green-700 hover:bg-green-50"
                      : "border-amber-600 text-amber-700 hover:bg-amber-50")
                  }
                >
                  <Power size={12} />
                  {bank.enabled === false ? "Enable" : "Disable"}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => onOpenEditBank(bank)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                >
                  <Edit3 size={14} />
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-orange-200 rounded-xl p-12 text-center bg-orange-50/30">
          <Building2 size={48} className="mx-auto mb-4 text-orange-400 opacity-60" />
          <p className="text-lg font-medium text-gray-700">No banks found</p>
          <p className="text-sm text-gray-500 mt-1">Add a bank to make it available in payment requests.</p>
        </div>
      )}
    </>
  );
}
