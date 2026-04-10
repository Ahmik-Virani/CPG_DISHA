import { Clock, History, Layers, CalendarClock } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import { userPaymentApi } from "../../lib/api";

export default function User() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");

  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");

  const [optionalRequests, setOptionalRequests] = useState([]);
  const [optionalLoading, setOptionalLoading] = useState(false);
  const [optionalError, setOptionalError] = useState("");

  const [historyRequests, setHistoryRequests] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [redirectVerifyLoading, setRedirectVerifyLoading] = useState(false);
  const [redirectVerifyMessage, setRedirectVerifyMessage] = useState("");
  const [redirectVerifyError, setRedirectVerifyError] = useState("");
  const hasRedirectedToReceipt = useRef(false);

  const pendingRequestsWithStatus = pendingRequests
    .map((request) => {
      const dueAt = new Date(request.timeToLive).getTime();
      const isOverdue = Number.isFinite(dueAt) && dueAt < Date.now();
      return {
        ...request,
        computedStatus: isOverdue ? "missed" : request.status,
        dueAt,
      };
    })
    .sort((a, b) => {
      const aSafe = Number.isFinite(a.dueAt) ? a.dueAt : Number.MAX_SAFE_INTEGER;
      const bSafe = Number.isFinite(b.dueAt) ? b.dueAt : Number.MAX_SAFE_INTEGER;
      return aSafe - bSafe;
    });

  useEffect(() => {
    if (activeTab !== "pending" || pendingRequests.length > 0) return;
    setPendingLoading(true);
    setPendingError("");
    userPaymentApi
      .getPending(token)
      .then((data) => setPendingRequests(data.requests || []))
      .catch((err) => setPendingError(err.message || "Failed to load pending transactions"))
      .finally(() => setPendingLoading(false));
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab !== "optional" || optionalRequests.length > 0) return;
    setOptionalLoading(true);
    setOptionalError("");
    userPaymentApi
      .getOptional(token)
      .then((data) => setOptionalRequests(data.requests || []))
      .catch((err) => setOptionalError(err.message || "Failed to load optional transactions"))
      .finally(() => setOptionalLoading(false));
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab !== "history" || historyRequests.length > 0) return;
    setHistoryLoading(true);
    setHistoryError("");
    userPaymentApi
      .getHistory(token)
      .then((data) => setHistoryRequests(data.transactions || []))
      .catch((err) => setHistoryError(err.message || "Failed to load transaction history"))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, token]);

  useEffect(() => {
    if (!token) return;

    const params = new URLSearchParams(location.search);
    const paymentRecordIdFromQuery = params.get("paymentRecordId") || "";
    const paymentRequestIdFromQuery = params.get("paymentRequestId") || "";
    const tranCtx = params.get("tranCtx") || params.get("tranctx") || "";

    const paymentRecordIdFromStorage = typeof window !== "undefined"
      ? String(window.localStorage.getItem("cpg:lastPaymentRecordId") || "")
      : "";
    const paymentRequestIdFromStorage = typeof window !== "undefined"
      ? String(window.localStorage.getItem("cpg:lastPaymentRequestId") || "")
      : "";

    const paymentRecordId = paymentRecordIdFromQuery || paymentRecordIdFromStorage;
    const paymentRequestId = paymentRequestIdFromQuery || paymentRequestIdFromStorage;

    if (!paymentRecordId && !paymentRequestId && !tranCtx) return;

    setRedirectVerifyLoading(true);
    setRedirectVerifyError("");
    setRedirectVerifyMessage("");

    userPaymentApi
      .verifyStatus(token, {
        paymentRecordId,
        paymentRequestId,
        tranCtx,
      })
      .then((data) => {
        const finalStatus = String(data?.status || "pending").toLowerCase();
        if (finalStatus === "success") {
          const targetPaymentId = data?.paymentRecord?.id || paymentRecordId || paymentRequestId;
          if (targetPaymentId) {
            hasRedirectedToReceipt.current = true;
            navigate(`/user/receipt/${targetPaymentId}`, { replace: true });
            return;
          }
          setRedirectVerifyMessage("Payment successful. Status synced.");
        } else if (finalStatus === "failed") {
          setRedirectVerifyError("Payment failed. Please try again.");
        } else {
          setRedirectVerifyMessage("Payment is still pending confirmation.");
        }

        setActiveTab("history");
        setHistoryRequests([]);
      })
      .catch((err) => {
        setRedirectVerifyError(err.message || "Failed to verify payment status");
      })
      .finally(() => {
        setRedirectVerifyLoading(false);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("cpg:lastPaymentRecordId");
          window.localStorage.removeItem("cpg:lastPaymentRequestId");
          if (!hasRedirectedToReceipt.current) {
            window.history.replaceState({}, document.title, "/user");
          }
        }
      });
  }, [location.search, navigate, token]);

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/orangegrid.jpg")' }}>
      <div className="min-h-screen bg-orange-50/50">
        <Header variant="modern" />

        <div className="px-10 pt-10 pb-2 text-center">
          <p className="text-3xl font-semibold text-gray-900 tracking-tight">
            Hello, <span className="text-orange-700">{user?.name || user?.email}</span>
          </p>
          <p className="text-gray-400 mt-2 text-lg">Here's your payment overview.</p>
        </div>

        {redirectVerifyLoading && (
          <p className="text-center text-gray-500 text-sm">Verifying payment status...</p>
        )}
        {!redirectVerifyLoading && redirectVerifyMessage && (
          <p className="text-center text-green-600 text-sm">{redirectVerifyMessage}</p>
        )}
        {!redirectVerifyLoading && redirectVerifyError && (
          <p className="text-center text-red-500 text-sm">{redirectVerifyError}</p>
        )}

        <div className="flex justify-center px-6 py-5">
          <div className="inline-flex bg-white border border-gray-200 shadow-sm p-1 rounded-full gap-1">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === "pending" ? "bg-orange-300 text-white shadow" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Clock size={15} /> Pending Transactions
            </button>
            <button
              onClick={() => setActiveTab("optional")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === "optional" ? "bg-orange-300 text-white shadow" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Layers size={15} /> Optional Transactions
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === "history" ? "bg-orange-300 text-white shadow" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <History size={15} /> Transaction History
            </button>
          </div>
        </div>

        <div className="px-6 pb-10">
          {activeTab === "pending" && (
            <div>
              {pendingLoading && <p className="text-center text-gray-400 mt-20">Loading...</p>}
              {!pendingLoading && pendingError && <p className="text-center text-red-500 mt-20">{pendingError}</p>}
              {!pendingLoading && !pendingError && pendingRequestsWithStatus.length === 0 && (
                <div className="text-center text-gray-400 mt-20">
                  <Clock size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-lg">No pending transactions</p>
                </div>
              )}
              {!pendingLoading && !pendingError && pendingRequestsWithStatus.length > 0 && (
                <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingRequestsWithStatus.map((req) => {
                    const hoursLeft = (req.dueAt - Date.now()) / (1000 * 60 * 60);
                    const isUrgent = req.computedStatus === "pending" && hoursLeft < 24;
                    const isSoon = req.computedStatus === "pending" && hoursLeft >= 24 && hoursLeft < 48;

                    return (
                      <Link
                        key={req.id}
                        to={"/user/payment/" + (req.id || req.eventId || "details")}
                        state={{
                          request: {
                            ...req,
                            status: String(req.status || "").trim().toLowerCase() === "paid" ? "paid" : "pending",
                          },
                        }}
                        className={`block bg-white rounded-xl border-2 p-5 shadow-sm hover:shadow-md active:bg-orange-50 transition-all ${
                          isUrgent ? "border-orange-300 bg-orange-50/60" : isSoon ? "border-amber-300" : "border-gray-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-gray-800">{req.eventName || "Unknown Event"}</p>
                            <p className="text-sm text-gray-500 mt-0.5">&#8377;{req.amount}</p>
                            {req.createdBySystemHeadName && (
                              <p className="text-xs text-gray-400 mt-0.5">by {req.createdBySystemHeadName}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                                req.computedStatus === "pending"
                                  ? "bg-orange-100 text-orange-700"
                                  : req.computedStatus === "missed"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {req.computedStatus}
                            </span>
                            {isUrgent && (
                              <span className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                                <CalendarClock size={12} /> Due in {Math.ceil(hoursLeft)}h
                              </span>
                            )}
                            {isSoon && (
                              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                <CalendarClock size={12} /> Due soon
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-3">Pay before: {new Date(req.timeToLive).toLocaleString()}</p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "optional" && (
            <div>
              {optionalLoading && <p className="text-center text-gray-400 mt-20">Loading...</p>}
              {!optionalLoading && optionalError && <p className="text-center text-red-500 mt-20">{optionalError}</p>}
              {!optionalLoading && !optionalError && optionalRequests.length === 0 && (
                <div className="text-center text-gray-400 mt-20">
                  <Layers size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-lg">No optional transactions</p>
                </div>
              )}
              {!optionalLoading && !optionalError && optionalRequests.length > 0 && (
                <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {optionalRequests.map((req) => (
                    <Link
                      key={req.id}
                      to={"/user/payment/" + (req.id || req.eventId || "details")}
                      state={{
                        request: {
                          ...req,
                          status: String(req.status || "").trim().toLowerCase() === "paid" ? "paid" : "pending",
                        },
                      }}
                      className="block bg-white rounded-xl border-2 border-gray-100 p-5 shadow-sm hover:shadow-md active:bg-orange-50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-gray-800">{req.eventName || "Unknown Event"}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{req.isAmountFixed ? `₹${req.amount}` : "Variable Amount"}</p>
                          {req.createdBySystemHeadName && (
                            <p className="text-xs text-gray-400 mt-0.5">by {req.createdBySystemHeadName}</p>
                          )}
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700 shrink-0">
                          {req.isAmountFixed ? "Fixed" : "Open"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div>
              {historyLoading && <p className="text-center text-gray-400 mt-20">Loading...</p>}
              {!historyLoading && historyError && <p className="text-center text-red-500 mt-20">{historyError}</p>}
              {!historyLoading && !historyError && historyRequests.length === 0 && (
                <div className="text-center text-gray-400 mt-20">
                  <History size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-lg">No transaction history yet</p>
                </div>
              )}
              {!historyLoading && !historyError && historyRequests.length > 0 && (
                <div className="max-w-6xl mx-auto overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3">Event</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Bank</th>
                        <th className="px-4 py-3">Txn ID</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRequests.map((entry) => {
                        const amount = Number(entry?.transaction?.amount);
                        const status = String(entry?.status || "pending").toLowerCase();
                        const isClickable = status === "success" || status === "paid";
                        return (
                          <tr
                            key={entry.id || entry.transaction?.transaction_id}
                            className={`border-t border-gray-100 ${isClickable ? "cursor-pointer hover:bg-orange-50 transition-colors" : ""}`}
                            onClick={() => {
                              if (isClickable && entry.id) {
                                navigate(`/user/receipt/${entry.id}`);
                              }
                            }}
                          >
                            <td className="px-4 py-3 text-gray-800">{entry.eventName || "Unknown Event"}</td>
                            <td className="px-4 py-3 text-gray-700">
                              {Number.isFinite(amount) ? `₹${amount.toLocaleString("en-IN")}` : "-"}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{entry?.bank?.bank_name || "-"}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{entry?.transaction?.transaction_id || "-"}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                                  status === "success" || status === "paid"
                                    ? "bg-green-100 text-green-700"
                                    : status === "failed"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
