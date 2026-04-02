import { useEffect, useState } from "react";
import { ArrowLeft, FileText, ReceiptIndianRupee } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import { userPaymentApi } from "../../lib/api";

function formatAmount(request) {
  if (request?.isAmountFixed === false) return "Variable";
  const amount = Number(request?.amount);
  if (!Number.isFinite(amount)) return "N/A";
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDeadline(request) {
  const rawDeadline = request?.timeToLive;
  if (!rawDeadline) return null;
  const deadline = new Date(rawDeadline);
  if (!Number.isFinite(deadline.getTime())) return null;
  return deadline.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "success" || normalized === "paid") return "success";
  if (normalized === "failed") return "failed";
  return "pending";
}

export default function PaymentDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const request = location.state?.request || null;
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [payStatusMessage, setPayStatusMessage] = useState("");
  const [isVerifyingStatus, setIsVerifyingStatus] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  const enabledBanks =
    Array.isArray(request?.banks) && request.banks.length
      ? request.banks
      : request?.bank
      ? [request.bank]
      : [];
  const [selectedBank, setSelectedBank] = useState(enabledBanks[0] || "");
  const isVariableAmount = request?.isAmountFixed === false;

  if (!request) {
    return (
      <div className="min-h-screen bg-orange-50 p-8">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Payment Details</h1>
          <p className="mt-2 text-sm text-gray-500">
            Payment details are unavailable. Please open this page from your transactions.
          </p>
          <button
            type="button"
            onClick={() => navigate("/user")}
            className="mt-5 inline-flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={15} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const status = normalizeStatus(request.status);
  const canInitiatePayment = status !== "success";
  const deadline = formatDeadline(request);

  useEffect(() => {
    if (!token || !request?.id) return;

    const params = new URLSearchParams(location.search);
    const paymentRecordId = params.get("paymentRecordId") || "";
    const tranCtx = params.get("tranCtx") || params.get("tranctx") || "";
    if (!paymentRecordId && !tranCtx) return;

    setIsVerifyingStatus(true);
    setPayError("");
    setPayStatusMessage("");

    userPaymentApi
      .verifyStatus(token, {
        paymentRecordId,
        paymentRequestId: request.id,
        tranCtx,
      })
      .then((data) => {
        const finalStatus = String(data?.status || "pending").toLowerCase();
        if (finalStatus === "success") {
          setPayStatusMessage("Payment successful. Status synced.");
        } else if (finalStatus === "failed") {
          setPayError("Payment failed. Please try again.");
        } else {
          setPayStatusMessage("Payment is still pending confirmation.");
        }
      })
      .catch((error) => {
        setPayError(error.message || "Failed to verify payment status");
      })
      .finally(() => {
        setIsVerifyingStatus(false);
        navigate(location.pathname, { replace: true, state: location.state });
      });
  }, [location.pathname, location.search, location.state, navigate, request?.id, token]);

  const handlePayNow = async () => {
    if (!request?.id || !token || !canInitiatePayment || !selectedBank) return;

    if (isVariableAmount) {
      const amount = parseFloat(customAmount);
      if (!customAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
        setPayError("Please enter a valid amount");
        return;
      }
    }

    setIsPaying(true);
    setPayError("");

    try {
      const payload = {
        paymentRequestId: request.id,
        bank: selectedBank,
        returnURL: window.location.origin + "/user",
      };
      if (isVariableAmount && customAmount.trim()) {
        payload.customAmount = parseFloat(customAmount);
      }
      const data = await userPaymentApi.initiateSale(token, payload);
      if (!data?.paymentURL) throw new Error("Payment URL is missing from gateway response");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cpg:lastPaymentRecordId", String(data?.paymentRecordId || ""));
        window.localStorage.setItem("cpg:lastPaymentRequestId", String(request.id || ""));
      }
      window.location.assign(data.paymentURL);
    } catch (error) {
      setPayError(error.message || "Failed to initiate payment");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/orangegrid.jpg")' }}>
      <div className="min-h-screen bg-orange-50/50">

      <Header variant="modern" />

      {/* ── Back link ── */}
      <div className="relative px-6 mt-3 z-20">
        <div className="inline-flex items-center rounded-full bg-white border border-gray-200 px-4 py-2 shadow-sm hover:shadow-md transition-shadow">
          <Link
            to="/user"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={15} /> Back to Transactions
          </Link>
        </div>
      </div>

      {/* ── Page content ── */}
      <div className="max-w-xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* ── Header ──
               Gradient: same hue family (orange-800 → orange-600), cohesive not jarring
               Reading flow: context → amount → status + deadline
          ── */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-300 px-6 pt-5 pb-4">

            {/* Context — more prominent */}
            <p className="text-sm font-semibold text-white/90 tracking-wide uppercase">
              {request.eventName || "Payment"}
              {request.eventDescription && (
                <span className="normal-case text-white/80"> · {request.eventDescription}</span>
              )}
            </p>

            {/* Amount — dominant */}
            <p className="text-3xl font-bold text-white mt-3 tracking-tight leading-none">
              {formatAmount(request)}
            </p>

            {/* Status + deadline — compact, clearly readable */}
            <div className="flex items-center gap-2.5 mt-4 flex-wrap">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${
                  status === "success"
                    ? "bg-green-500/20 text-green-200 border-green-400/30"
                    : status === "failed"
                    ? "bg-red-500/20 text-red-200 border-red-400/30"
                    : "bg-white/10 text-white/90 border-white/15"
                }`}
              >
                {status}
              </span>

              {deadline && (
                <span className="text-xs text-white/70">
                  Due {deadline}
                </span>
              )}

              {request.createdBySystemHeadName && (
                <span className="text-xs text-white/60 ml-auto">
                  by {request.createdBySystemHeadName}
                </span>
              )}
            </div>
          </div>

          {/* ── Body: actionable content only ── */}
          <div className="px-6 py-8 space-y-6">

            {/* Variable amount */}
            {isVariableAmount && (
              <div>
                <label
                  htmlFor="custom-amount"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Enter Amount (₹)
                </label>
                <input
                  id="custom-amount"
                  type="number"
                  placeholder="Enter amount in rupees"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setPayError("");
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-600 transition-colors text-base"
                  min="1"
                  step="0.01"
                />
              </div>
            )}

            {/* Bank selector */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2.5">Pay via</p>
              {enabledBanks.length ? (
                <div className="flex flex-wrap gap-2">
                  {enabledBanks.map((bank) => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => { setSelectedBank(bank); setPayError(""); }}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium border-2 transition-all active:scale-[0.97] ${
                        selectedBank === bank
                          ? "bg-orange-400 border-orange-400 text-white shadow-md"
                          : "bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                      }`}
                    >
                      {bank}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-red-500">No banks available for this payment</p>
              )}
            </div>

            {isVerifyingStatus && (
              <p className="text-sm text-gray-500 -mt-2">Verifying payment status...</p>
            )}
            {payStatusMessage && (
              <p className="text-sm text-green-600 -mt-2">{payStatusMessage}</p>
            )}
            {payError && (
              <p className="text-sm text-red-500 -mt-2">{payError}</p>
            )}

            {/* Pay Now */}
            <button
              type="button"
              onClick={handlePayNow}
              disabled={
                isPaying ||
                !canInitiatePayment ||
                !selectedBank ||
                (isVariableAmount && (!customAmount.trim() || parseFloat(customAmount) <= 0))
              }
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-400 text-white px-6 py-3.5 font-semibold text-base shadow-md hover:bg-orange-500 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md"
            >
              <ReceiptIndianRupee size={18} />
              {isPaying ? "Redirecting to bank..." : "Pay Now"}
            </button>

            {status === "success" && (
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <FileText size={15} /> Open Receipt
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
