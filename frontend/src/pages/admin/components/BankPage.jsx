import { Plus } from "lucide-react";

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
          className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
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
              className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-lg">{bank.displayName}</h3>
                  <p
                    className={
                      "mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium " +
                      (bank.enabled === false ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")
                    }
                  >
                    {bank.enabled === false ? "Disabled" : "Enabled"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleBankStatus(bank)}
                  className={
                    "rounded-lg border px-3 py-1.5 text-xs font-medium " +
                    (bank.enabled === false
                      ? "border-green-600 text-green-700"
                      : "border-amber-600 text-amber-700")
                  }
                >
                  {bank.enabled === false ? "Enable" : "Disable"}
                </button>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => onOpenEditBank(bank)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-lg font-medium text-gray-700">No banks found</p>
          <p className="text-sm text-gray-500 mt-1">Add a bank to make it available in payment requests.</p>
        </div>
      )}
    </>
  );
}
