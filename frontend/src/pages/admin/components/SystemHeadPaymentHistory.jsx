import { History, CreditCard, ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import Header from "../../../components/Header";
import { adminApi } from "../../../lib/api";

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

export default function SystemHeadPaymentHistory() {
  const navigate = useNavigate();
  const { systemHeadId } = useParams();
  const { token, user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [systemHead, setSystemHead] = useState(null);

  const fetchSystemHeadDetails = useCallback(async () => {
    if (!token || !systemHeadId) return;
    try {
      const data = await adminApi.listSystemHeads(token);
      const heads = Array.isArray(data.users) ? data.users : [];
      const head = heads.find(h => h.id === systemHeadId);
      setSystemHead(head || null);
    } catch (err) {
      console.error("Failed to load system head details", err);
    }
  }, [token, systemHeadId]);

  const fetchTransactions = useCallback(async () => {
    if (!token || !systemHeadId) return;
    setIsLoading(true);
    setError("");
    try {
      const data = await adminApi.getSystemHeadPaymentHistory(token, systemHeadId);
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (err) {
      setError(err.message || "Failed to load payment history");
    } finally {
      setIsLoading(false);
    }
  }, [token, systemHeadId]);

  useEffect(() => {
    fetchSystemHeadDetails();
    fetchTransactions();
  }, [fetchSystemHeadDetails, fetchTransactions]);

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/orangegrid.jpg")' }}>
        <div className="min-h-screen bg-orange-50/50">
          <Header variant="modern" />
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="text-center">
              <p className="text-red-600">Access denied. Admin role required.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalCollected = transactions
    .filter((t) => t.status === "paid" || t.status === "success")
    .reduce((sum, t) => sum + (Number(t.transaction?.amount) || 0), 0);
  const pendingCount = transactions.filter((t) => t.status === "pending").length;
  const failedCount = transactions.filter((t) => t.status === "failed").length;

  return (
    // We lock the height to the viewport (h-screen) and hide overall page scrolling
    <div className="h-screen overflow-hidden bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/orangegrid.jpg")' }}>
      <div className="h-full flex flex-col bg-orange-50/50">
        <Header variant="modern" />

        {/* Dashboard Split Layout */}
        <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 flex gap-8 overflow-hidden">
          
          {/* LEFT PANEL: Fixed Context & Stats */}
          <div className="w-80 shrink-0 flex flex-col gap-6 overflow-y-auto pb-4">
            
            {/* Fixed Back Button */}
            <div>
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm hover:shadow-md transition-shadow"
              >
                <ArrowLeft size={15} /> Back to Admin
              </button>
            </div>

            {/* Title Block */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <History className="h-6 w-6 text-orange-500" />
                <p className="text-gray-500 text-sm font-medium">Payment History</p>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {systemHead ? systemHead.name : `System Head ID: ${systemHeadId}`}
              </h1>
              <p className="text-gray-500 mt-1 text-sm break-words">
                {systemHead ? systemHead.email : ""}
              </p>
            </div>

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

          {/* RIGHT PANEL: Scrollable Transactions Window */}
          <div className="flex-1 flex flex-col bg-white/60 rounded-2xl border border-white shadow-inner overflow-hidden">
            
            {/* Header for the transaction window */}
            <div className="px-6 py-4 border-b border-gray-100/50 bg-white/50 backdrop-blur-sm flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-800">Transactions</h2>
              {!isLoading && (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                  {transactions.length} Total
                </span>
              )}
            </div>
            
            {/* The actual scrolling list (overflow-y-auto applies ONLY to this div) */}
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

        </div>
      </div>
    </div>
  );
}