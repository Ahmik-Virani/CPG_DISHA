import { History, PlusCircle, CreditCard, Link2, Copy } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import { eventApi, externalLinkApi } from "../../lib/api";

function StatusBadge({ status }) {
  const styles = {
    paid: "bg-green-100 text-green-700",
    success: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-600",
  };
  const label = status === "success" ? "Successful" : status === "paid" ? "Paid" : (status || "unknown");
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || "bg-gray-100 text-gray-500"}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }) {
  if (type === "external") {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
        External
      </span>
    );
  }

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

  const initialTab = searchParams.get("tab") === "payment-history"
    ? "payment-history"
    : searchParams.get("tab") === "external-api"
      ? "external-api"
      : "settlement";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [externalAmount, setExternalAmount] = useState("");
  const [externalLinkUrl, setExternalLinkUrl] = useState("");
  const [externalError, setExternalError] = useState("");
  const [isGeneratingExternalUrl, setIsGeneratingExternalUrl] = useState(false);
  const [externalLinkMeta, setExternalLinkMeta] = useState(null);
  const [isLoadingExternalMeta, setIsLoadingExternalMeta] = useState(false);
  const [isUpdatingExternalStatus, setIsUpdatingExternalStatus] = useState(false);

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

  const loadExternalLinkMeta = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoadingExternalMeta(true);
    setExternalError("");
    try {
      const data = await externalLinkApi.ensureMyLink(token);
      setExternalLinkMeta(data?.link || null);
    } catch (err) {
      setExternalError(err.message || "Failed to load external link details");
    } finally {
      setIsLoadingExternalMeta(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab !== "external-api") {
      return;
    }

    setExternalAmount("");
    setExternalLinkUrl("");
    setExternalError("");
    void loadExternalLinkMeta();
  }, [activeTab, loadExternalLinkMeta]);

  const openExternalTab = () => {
    setActiveTab("external-api");
    setExternalAmount("");
    setExternalLinkUrl("");
    setExternalError("");
  };

  const generateExternalUrl = async () => {
    if (String(externalLinkMeta?.status || "active") !== "active") {
      setExternalError("External link is disabled. Enable it before generating URLs.");
      return;
    }

    const amount = Number(externalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setExternalError("Please enter a valid amount greater than 0");
      return;
    }

    setIsGeneratingExternalUrl(true);
    setExternalError("");
    setExternalLinkUrl("");

    try {
      const data = await externalLinkApi.createPaymentUrl(token, { amount });
      const paymentPath = String(data?.paymentPath || "").trim();
      if (!paymentPath) {
        throw new Error("Failed to generate external URL");
      }

      const fullUrl = window.location.origin + paymentPath;
      setExternalLinkUrl(fullUrl);
    } catch (err) {
      setExternalError(err.message || "Failed to generate external URL");
    } finally {
      setIsGeneratingExternalUrl(false);
    }
  };

  const copyExternalUrl = async () => {
    if (!externalLinkUrl) return;

    try {
      await navigator.clipboard.writeText(externalLinkUrl);
    } catch {
      setExternalError("Unable to copy link automatically. Please copy it manually.");
    }
  };

  const toggleExternalLinkStatus = async () => {
    if (!externalLinkMeta?.id) {
      return;
    }

    const nextStatus = String(externalLinkMeta.status || "active") === "active" ? "disabled" : "active";
    setIsUpdatingExternalStatus(true);
    setExternalError("");
    try {
      const data = await externalLinkApi.updateMyLinkStatus(token, externalLinkMeta.id, nextStatus);
      setExternalLinkMeta(data?.link || null);
      if (nextStatus === "disabled") {
        setExternalLinkUrl("");
      }
    } catch (err) {
      setExternalError(err.message || "Failed to update external link status");
    } finally {
      setIsUpdatingExternalStatus(false);
    }
  };

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
            <button
              onClick={openExternalTab}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-gray-500 hover:text-gray-900 transition-all duration-200"
            >
              <Link2 size={15} /> External API
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 pb-10 flex gap-8 h-[calc(100vh-150px)]">

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
                            {txn.type === "external"
                              ? `External · ${txn.student?.email || "—"}`
                              : `${txn.student?.name || "—"} · ${txn.student?.roll_no || "—"}`}
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
          )}

          {activeTab === "settlement" && (
            <div className="text-center text-gray-400 py-20">No settlement history.</div>
          )}

          {activeTab === "external-api" && (
            <div className="flex-1 flex items-start justify-center">
              <div className="w-full max-w-2xl rounded-2xl border border-white bg-white/70 shadow-inner p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 size={18} className="text-orange-500" />
                  <h2 className="text-lg font-semibold text-gray-900">External API</h2>
                </div>
                <p className="text-sm text-gray-500">
                  Generate a public URL for any amount. The link stays tied to this system head.
                </p>

                <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-1">
                  <p className="text-xs font-medium text-gray-500">External Link Details</p>
                  {isLoadingExternalMeta ? (
                    <p className="text-sm text-gray-500">Loading link details...</p>
                  ) : externalLinkMeta ? (
                    <>
                      <p className="text-sm text-gray-700 break-all">Link ID: {externalLinkMeta.id}</p>
                      <p className="text-sm text-gray-700">
                        Status:{" "}
                        <span className={String(externalLinkMeta.status || "") === "active" ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                          {String(externalLinkMeta.status || "active")}
                        </span>
                      </p>
                      <p className="text-sm text-gray-700">Usage Count: {Number(externalLinkMeta.usageCount || 0)}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No external link found</p>
                  )}
                </div>

                <div className="mt-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={externalAmount}
                    onChange={(e) => setExternalAmount(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-orange-500"
                    placeholder="1000"
                  />
                </div>

                {externalError && <p className="mt-3 text-sm text-red-600">{externalError}</p>}

                {externalLinkUrl && (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Public URL</p>
                    <p className="text-sm break-all text-gray-700">{externalLinkUrl}</p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2 justify-end">
                  {externalLinkUrl && (
                    <button
                      type="button"
                      onClick={copyExternalUrl}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Copy size={14} /> Copy URL
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleExternalLinkStatus}
                    disabled={isUpdatingExternalStatus || !externalLinkMeta?.id}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {isUpdatingExternalStatus
                      ? "Updating..."
                      : String(externalLinkMeta?.status || "active") === "active"
                        ? "Disable Link"
                        : "Enable Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExternalAmount("");
                      setExternalLinkUrl("");
                      setExternalError("");
                    }}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={generateExternalUrl}
                    disabled={isGeneratingExternalUrl || String(externalLinkMeta?.status || "active") !== "active"}
                    className="px-4 py-2 rounded-xl bg-orange-500 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
                  >
                    {isGeneratingExternalUrl ? "Generating..." : "Generate URL"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}