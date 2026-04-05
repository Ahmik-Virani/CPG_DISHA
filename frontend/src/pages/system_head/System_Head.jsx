import { History, PlusCircle, CreditCard } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import { eventApi } from "../../lib/api";

function StatusBadge({ status }) {
  const styles = {
    paid: "bg-green-100 text-green-700",
    success: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-600",
  };
  const label = status === "success" ? "paid" : (status || "unknown");
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || "bg-gray-100 text-gray-500"}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${type === "fixed" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
      {type === "fixed" ? "Fixed" : "One-Time"}
    </span>
  );
}

export default function SystemHead() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();

  const initialTab = searchParams.get("tab") === "payment-history" ? "payment-history" : "settlement";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError("");
    try {
      const data = await eventApi.getTransactionHistory(token);
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (err) {
      setError(err.message || "Failed to load transactions");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "payment-history") {
      fetchTransactions();
    }
  }, [activeTab, fetchTransactions]);

  const totalCollected = transactions
    .filter((t) => t.status === "paid" || t.status === "success")
    .reduce((sum, t) => sum + (Number(t.transaction?.amount) || 0), 0);
  const pendingCount = transactions.filter((t) => t.status === "pending").length;
  const failedCount = transactions.filter((t) => t.status === "failed").length;

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/orangegrid.jpg")' }}>
      <div className="min-h-screen bg-orange-50/50">
        <Header variant="modern" />

        {/* Tab Bar */}
        <div className="flex justify-center px-6 py-5">
          <div className="inline-flex bg-white border border-gray-200 shadow-sm p-1 rounded-full gap-1">
            <button
              onClick={() => navigate("/system_head/manage-event")}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-gray-500 hover:text-gray-900 transition-all duration-200"
            >
              <PlusCircle size={15} /> Manage Events
            </button>
            <button
              onClick={() => setActiveTab("payment-history")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === "payment-history"
                  ? "bg-orange-400 text-white shadow"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <CreditCard size={15} /> Payment History
            </button>
            <button
              onClick={() => setActiveTab("settlement")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === "settlement"
                  ? "bg-orange-400 text-white shadow"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <History size={15} /> Settlement History
            </button>
          </div>
<<<<<<< HEAD
      </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 pb-10">

          {activeTab === "payment-history" && (
            <div>
              {/* Summary */}
              {!isLoading && !error && transactions.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">Total Collected</p>
                    <p className="text-xl font-bold text-green-600">₹{totalCollected.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">Pending</p>
                    <p className="text-xl font-bold text-yellow-600">{pendingCount}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1">Failed</p>
                    <p className="text-xl font-bold text-red-500">{failedCount}</p>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="text-center text-gray-400 py-20">Loading transactions...</div>
              )}
              {error && (
                <div className="text-center text-red-500 py-20">{error}</div>
              )}
              {!isLoading && !error && transactions.length === 0 && (
                <div className="text-center text-gray-400 py-20">No payment history yet.</div>
              )}

              {/* Transaction List */}
              {!isLoading && !error && transactions.length > 0 && (
                <div className="flex flex-col gap-3">
                  {transactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{txn.eventName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {txn.student?.name || "—"} &middot; {txn.student?.roll_no || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                        <TypeBadge type={txn.type} />
                        <span className="text-sm font-semibold text-gray-800">
                          ₹{Number(txn.transaction?.amount || 0).toLocaleString("en-IN")}
                        </span>
                        {txn.bank?.bank_name && (
                          <span className="text-xs text-gray-400">{txn.bank.bank_name}</span>
                        )}
                        <StatusBadge status={txn.status} />
                        <span className="text-xs text-gray-300">
                          {txn.createdAt ? new Date(txn.createdAt).toLocaleDateString("en-IN") : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
=======
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 pb-10 flex gap-8 h-[calc(100vh-220px)]">

          {activeTab === "payment-history" && (
            <>
              {/* LEFT PANEL: Summary Stats */}
              <div className="w-80 shrink-0 flex flex-col gap-6">
                {/* Summary Stats (Stacked Vertically) */}
                {!isLoading && !error && transactions.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      <p className="text-xs text-gray-400 mb-1">Total Collected</p>
                      <p className="text-2xl font-bold text-green-600">₹{totalCollected.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-400 mb-1">Pending</p>
                        <p className="text-lg font-bold text-yellow-600">{pendingCount}</p>
                      </div>
                      <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs text-gray-400 mb-1">Failed</p>
                        <p className="text-lg font-bold text-red-500">{failedCount}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT PANEL: Scrollable Transactions */}
              <div className="flex-1 flex flex-col bg-white/60 rounded-2xl border border-white shadow-inner overflow-hidden max-h-full">
                
                {/* Header for the transaction window */}
                <div className="px-6 py-4 border-b border-gray-100/50 bg-white/50 backdrop-blur-sm flex justify-between items-center">
                  <h2 className="text-base font-semibold text-gray-800">Transactions</h2>
                  {!isLoading && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                      {transactions.length} Total
                    </span>
                  )}
                </div>
                
                {/* The actual scrolling list */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                  {isLoading && (
                    <div className="text-center text-gray-400 py-20">Loading transactions...</div>
                  )}
                  {error && (
                    <div className="text-center text-red-500 py-20">{error}</div>
                  )}
                  {!isLoading && !error && transactions.length === 0 && (
                    <div className="text-center text-gray-400 py-20">No payment history yet.</div>
                  )}

                  {!isLoading && !error && transactions.length > 0 && (
                    transactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{txn.eventName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {txn.student?.name || "—"} &middot; {txn.student?.roll_no || "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                          <TypeBadge type={txn.type} />
                          <span className="text-sm font-semibold text-gray-800">
                            ₹{Number(txn.transaction?.amount || 0).toLocaleString("en-IN")}
                          </span>
                          {txn.bank?.bank_name && (
                            <span className="text-xs text-gray-400">{txn.bank.bank_name}</span>
                          )}
                          <StatusBadge status={txn.status} />
                          <span className="text-xs text-gray-300 w-20 text-right">
                            {txn.createdAt ? new Date(txn.createdAt).toLocaleDateString("en-IN") : "—"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
>>>>>>> latest
          )}

          {activeTab === "settlement" && (
            <div className="text-center text-gray-400 py-20">No settlement history.</div>
          )}
        </div>
      </div>
    </div>
  );
}
