import {
  Clock,
  History,
  Store,
  LogOut,
  Layers,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { userPaymentApi } from "../../lib/api";

export default function User() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");

  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");

  const [optionalRequests, setOptionalRequests] = useState([]);
  const [optionalLoading, setOptionalLoading] = useState(false);
  const [optionalError, setOptionalError] = useState("");

  const pendingRequestsWithStatus = pendingRequests
    .map((request) => {
      const dueAt = new Date(request.timeToLive).getTime();
      const isOverdue = Number.isFinite(dueAt) && dueAt < Date.now();
      return {
        ...request,
        computedStatus: isOverdue ? "missed" : request.status,
      };
    })
    .sort((a, b) => {
      const aDue = new Date(a.timeToLive).getTime();
      const bDue = new Date(b.timeToLive).getTime();
      const aSafe = Number.isFinite(aDue) ? aDue : Number.MAX_SAFE_INTEGER;
      const bSafe = Number.isFinite(bDue) ? bDue : Number.MAX_SAFE_INTEGER;
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

  return (
    <div className="min-h-screen bg-sky-50">
      {/* Navbar */}
      <div className="flex justify-between items-center px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            <Store size={20} />
          </div>
          <div>
            <h1 className="font-semibold text-lg">IIT Hyderabad Payment Gateway</h1>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/change-password" className="border px-4 py-2 rounded-lg">
            Change Password
          </Link>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="border px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-sky-50 px-6 py-4">
        <div className="inline-flex bg-gray-200 p-1 rounded-full gap-1">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "pending"
                ? "bg-white shadow text-black"
                : "text-gray-600 hover:text-black"
            }`}
          >
            <Clock size={16} /> Pending Transactions
          </button>

          <button
            onClick={() => setActiveTab("optional")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "optional"
                ? "bg-white shadow text-black"
                : "text-gray-600 hover:text-black"
            }`}
          >
            <Layers size={16} /> Optional Transactions
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "history"
                ? "bg-white shadow text-black"
                : "text-gray-600 hover:text-black"
            }`}
          >
            <History size={16} /> Transaction History
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-8">
        {activeTab === "pending" && (
          <div>
            {pendingLoading && (
              <p className="text-center text-gray-400 mt-20">Loading...</p>
            )}
            {!pendingLoading && pendingError && (
              <p className="text-center text-red-500 mt-20">{pendingError}</p>
            )}
            {!pendingLoading && !pendingError && pendingRequestsWithStatus.length === 0 && (
              <div className="text-center text-gray-500 text-xl mt-20">
                No pending transactions
              </div>
            )}
            {!pendingLoading && !pendingError && pendingRequestsWithStatus.length > 0 && (
              <div className="max-w-2xl mx-auto flex flex-col gap-4">
                {pendingRequestsWithStatus.map((req) => (
                  <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-800">&#8377;{req.amount}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                        req.computedStatus === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : req.computedStatus === "missed"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                      }`}>
                        {req.computedStatus}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Pay Before:</span> {new Date(req.timeToLive).toLocaleString()}</p>
                      <p><span className="font-medium">Event:</span> {req.eventName || "Unknown Event"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "optional" && (
          <div>
            {optionalLoading && (
              <p className="text-center text-gray-400 mt-20">Loading...</p>
            )}
            {!optionalLoading && optionalError && (
              <p className="text-center text-red-500 mt-20">{optionalError}</p>
            )}
            {!optionalLoading && !optionalError && optionalRequests.length === 0 && (
              <div className="text-center text-gray-500 text-xl mt-20">
                No optional transactions
              </div>
            )}
            {!optionalLoading && !optionalError && optionalRequests.length > 0 && (
              <div className="max-w-2xl mx-auto flex flex-col gap-4">
                {optionalRequests.map((req) => (
                  <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-800">
                        {req.isAmountFixed ? `\u20B9${req.amount}` : "Variable Amount"}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                        {req.isAmountFixed ? "Fixed" : "Open"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Event:</span> {req.eventName || "Unknown Event"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="text-center text-gray-500 text-xl mt-20">
            No transaction history
          </div>
        )}
      </div>
    </div>
  );
}
