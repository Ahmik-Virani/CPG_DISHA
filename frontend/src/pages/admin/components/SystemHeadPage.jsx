import { Search, Plus, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function SystemHeadPage({
  filteredHeads,
  searchQuery,
  onSearchChange,
  error,
  isLoading,
  onOpenAddMerchant,
}) {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Manage System Heads</h2>
        </div>

        <button
          onClick={onOpenAddMerchant}
          className="bg-orange-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-orange-500 transition-colors duration-300"
        >
          <Plus size={16} /> Add Merchant
        </button>
      </div>

      <div className="flex items-center bg-white border rounded-lg px-3 py-2 w-87.5 mb-8">
        <Search size={16} className="text-gray-500" />
        <input
          className="ml-2 outline-none w-full"
          placeholder="Search System Head..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {isLoading ? (
        <div className="text-center text-gray-500">Loading system heads...</div>
      ) : filteredHeads.length > 0 ? (
        <div className="grid grid-cols-3 gap-6">
          {filteredHeads.map((sh) => (
            <Link
              key={sh.id}
              to={`/admin/system-head/${sh.id}/payment-history`}
              className="group relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer block"
            >
              <div className="absolute top-6 right-6 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none">
                <ArrowUpRight size={18} className="text-gray-600" />
              </div>

              <h3 className="font-semibold text-lg mb-1">{sh.name}</h3>
              <p className="text-gray-500 text-sm">{sh.email}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-lg font-medium text-gray-700">
            {searchQuery.trim() ? "No matching system heads" : "No system heads found"}
          </p>
        </div>
      )}
    </>
  );
}
