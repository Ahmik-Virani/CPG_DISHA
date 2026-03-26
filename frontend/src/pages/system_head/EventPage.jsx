import { useEffect, useState } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import { eventApi } from "../../lib/api";
import { createOneTimeRow, normalizeRollNoInput } from "./utils/oneTimeCsv";
import { formatPaymentType } from "./utils/paymentRequestUi";
import PaymentTypeChooser from "./components/PaymentTypeChooser";
import PaymentRequestDetails from "./components/PaymentRequestDetails";
import PaymentRequestForm from "./components/PaymentRequestForm";

export default function EventPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId } = useParams();
  const { user, token, logout } = useAuth();
  const [event, setEvent] = useState(location.state?.event || null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(!location.state?.event);
  const [isActing, setIsActing] = useState(false);
  const [paymentStep, setPaymentStep] = useState("idle");
  const [paymentType, setPaymentType] = useState("");
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [isLoadingPaymentRequest, setIsLoadingPaymentRequest] = useState(true);
  const [bankOptions, setBankOptions] = useState([]);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    oneTimeRows: [createOneTimeRow(1)],
    banks: [],
    amount: "",
    timeToLive: "",
    isAmountFixed: false,
  });
  const [nextOneTimeRowId, setNextOneTimeRowId] = useState(2);
  const [paymentFeedback, setPaymentFeedback] = useState({ type: "", message: "" });
  const canShowPaymentActions = Boolean(event?.isOngoing || paymentRequest);

  useEffect(() => {
    let isMounted = true;
    async function loadEvent() {
      if (!token || !eventId) {
        if (isMounted) { setIsLoading(false); setIsLoadingPaymentRequest(false); }
        return;
      }
      try {
        if (isMounted) setIsLoadingPaymentRequest(true);
        const [eventData, paymentData, bankData] = await Promise.all([
          eventApi.getOne(token, eventId),
          eventApi.getLatestPaymentRequest(token, eventId),
          eventApi.listBankOptions(token),
        ]);
        if (isMounted) {
          setEvent(eventData.event || null);
          setPaymentRequest(paymentData.paymentRequest || null);
          const resolvedBanks = Array.isArray(bankData.banks)
            ? bankData.banks.map((bank) => String(bank?.name || "").trim()).filter(Boolean)
            : [];
          setBankOptions(resolvedBanks);
        }
      } catch (err) {
        if (isMounted) { setError(err.message || "Failed to load event"); setBankOptions([]); }
      } finally {
        if (isMounted) { setIsLoading(false); setIsLoadingPaymentRequest(false); }
      }
    }
    loadEvent();
    return () => { isMounted = false; };
  }, [eventId, token]);

  const handleMarkDone = async () => {
    if (!event?.isOngoing) return;
    if (!window.confirm("Mark this event as done?")) return;
    setIsActing(true);
    setError("");
    try {
      const data = await eventApi.markDone(token, eventId);
      setEvent(data.event || null);
    } catch (err) {
      setError(err.message || "Failed to mark event as done");
    } finally {
      setIsActing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    setIsActing(true);
    setError("");
    try {
      await eventApi.remove(token, eventId);
      navigate("/system_head/manage-event", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to delete event");
      setIsActing(false);
    }
  };

  const resetPaymentForm = () => {
    setPaymentForm({ oneTimeRows: [createOneTimeRow(1)], banks: [], amount: "", timeToLive: "", isAmountFixed: false });
    setNextOneTimeRowId(2);
  };

  const openPaymentChooser = () => {
    if (paymentRequest) return;
    setPaymentStep("choose");
    setPaymentType("");
    resetPaymentForm();
    setPaymentFeedback({ type: "", message: "" });
  };

  const choosePaymentType = (type) => {
    setPaymentType(type);
    resetPaymentForm();
    setPaymentStep("form");
    setPaymentFeedback({ type: "", message: "" });
  };

  const selectBank = (bank) => {
    setPaymentForm((prev) => ({
      ...prev,
      banks: prev.banks.includes(bank) ? prev.banks.filter((b) => b !== bank) : [...prev.banks, bank],
    }));
  };

  const addOneTimeRow = () => {
    setPaymentForm((prev) => ({ ...prev, oneTimeRows: [...prev.oneTimeRows, createOneTimeRow(nextOneTimeRowId)] }));
    setNextOneTimeRowId((prev) => prev + 1);
  };

  const removeOneTimeRow = (rowId) => {
    setPaymentForm((prev) => {
      if (prev.oneTimeRows.length <= 1) return prev;
      return { ...prev, oneTimeRows: prev.oneTimeRows.filter((row) => row.rowKey !== rowId) };
    });
  };

  const updateOneTimeRow = (rowId, field, value) => {
    setPaymentForm((prev) => ({
      ...prev,
      oneTimeRows: prev.oneTimeRows.map((row) =>
        row.rowKey !== rowId ? row : { ...row, [field]: field === "rollNo" ? normalizeRollNoInput(value) : value }
      ),
    }));
  };

  const importOneTimeRows = (rows) => {
    const maxRowKey = rows.reduce((max, row) => {
      const key = Number(row?.rowKey);
      return Number.isFinite(key) ? Math.max(max, key) : max;
    }, 0);
    setPaymentForm((prev) => ({ ...prev, oneTimeRows: rows }));
    setNextOneTimeRowId(maxRowKey + 1);
  };

  const handlePaymentFormCancel = () => {
    setPaymentStep("choose");
    setPaymentFeedback({ type: "", message: "" });
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentType) { setPaymentFeedback({ type: "error", message: "Please choose a payment request type." }); return; }
    if (!Array.isArray(paymentForm.banks) || !paymentForm.banks.length) { setPaymentFeedback({ type: "error", message: "Select at least one bank." }); return; }

    const payload = { type: paymentType, banks: paymentForm.banks };

    if (paymentType === "one_time") {
      const entries = paymentForm.oneTimeRows
        .map((row) => ({ rollNo: normalizeRollNoInput(row.rollNo), amount: Number(row.amount) }))
        .filter((entry) => entry.rollNo || Number.isFinite(entry.amount));
      const ttlDate = new Date(paymentForm.timeToLive);
      const hasInvalidEntry = entries.some((e) => !e.rollNo || !Number.isFinite(e.amount) || e.amount <= 0);
      const hasDuplicateRollNos = new Set(entries.map((e) => e.rollNo)).size !== entries.length;
      if (!entries.length || hasInvalidEntry || Number.isNaN(ttlDate.getTime())) {
        setPaymentFeedback({ type: "error", message: "Each row needs a valid Roll No and amount greater than 0, along with valid time to live." });
        return;
      }
      if (hasDuplicateRollNos) { setPaymentFeedback({ type: "error", message: "Duplicate roll numbers are not allowed." }); return; }
      payload.entries = entries;
      payload.timeToLive = ttlDate.toISOString();
    }

    if (paymentType === "fixed") {
      payload.isAmountFixed = paymentForm.isAmountFixed;
      if (paymentForm.isAmountFixed) {
        const amount = Number(paymentForm.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          setPaymentFeedback({ type: "error", message: "Amount must be greater than 0 when fixed amount is enabled." });
          return;
        }
        payload.amount = amount;
      }
    }

    setIsActing(true);
    setPaymentFeedback({ type: "", message: "" });
    try {
      const data = await eventApi.createPaymentRequest(token, eventId, payload);
      setPaymentRequest(data.paymentRequest || payload);
      setShowPaymentDetails(true);
      setPaymentFeedback({ type: "success", message: "Payment request created successfully." });
      resetPaymentForm();
      setPaymentType("");
      setPaymentStep("idle");
    } catch (err) {
      setPaymentFeedback({ type: "error", message: err.message || "Failed to create payment request." });
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/orangegrid.jpg")' }}>
      <div className="min-h-screen bg-orange-50/50">

      <Header variant="modern" />

      {/* ── Back nav ── */}
      <div className="relative px-6 mt-3 z-20">
        <div className="inline-flex items-center rounded-full bg-white border border-gray-200 px-4 py-2 shadow-sm hover:shadow-md transition-shadow">
          <button
            type="button"
            onClick={() => navigate("/system_head/manage-event")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={15} /> Back to Events
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 py-6 pb-10">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <div className="text-center text-gray-400 py-20">Loading event...</div>
        ) : event ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

            {/* ── Event header — slim ── */}
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-white/60 uppercase tracking-wide mb-0.5">Event</p>
                <h2 className="text-lg font-bold text-white leading-tight">{event.name}</h2>
              </div>
              <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                event.isOngoing
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-green-500/20 text-green-200 border-green-400/30"
              }`}>
                {event.isOngoing ? "Ongoing" : "Done"}
              </span>
            </div>

            {/* ── Body ── */}
            <div className="px-6 py-5 space-y-5">

              {/* Description */}
              {event.description && (
                <p className="text-sm text-gray-600">{event.description}</p>
              )}

              {/* Primary + payment actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {canShowPaymentActions && (
                  <>
                    {paymentRequest ? (
                      <button
                        type="button"
                        onClick={() => setShowPaymentDetails((prev) => !prev)}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-400 text-white hover:bg-orange-500 transition-colors shadow-sm"
                      >
                        {showPaymentDetails ? "Hide Request Details" : "View Request Details"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={openPaymentChooser}
                        disabled={isLoadingPaymentRequest}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-400 text-white hover:bg-orange-500 transition-colors shadow-sm disabled:opacity-60"
                      >
                        {isLoadingPaymentRequest ? "Loading..." : "Request Payment"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Check Payment Status
                    </button>
                  </>
                )}

                {/* Destructive — lower visual weight, pushed right */}
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={handleMarkDone}
                    disabled={isActing || !event.isOngoing}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                      event.isOngoing
                        ? "border-gray-200 text-gray-500 hover:bg-gray-50"
                        : "border-green-200 text-green-700 bg-green-50"
                    }`}
                  >
                    {event.isOngoing ? "Mark as Done" : "Completed"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isActing}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Payment request details */}
              {paymentRequest && showPaymentDetails && (
                <PaymentRequestDetails paymentRequest={paymentRequest} formatPaymentType={formatPaymentType} />
              )}

              {/* Payment type chooser */}
              {paymentStep === "choose" && (
                <PaymentTypeChooser
                  onChoosePaymentType={choosePaymentType}
                  onCancel={() => { setPaymentStep("idle"); setPaymentType(""); }}
                />
              )}

              {/* Payment form */}
              {paymentStep === "form" && (
                <PaymentRequestForm
                  paymentType={paymentType}
                  paymentForm={paymentForm}
                  isActing={isActing}
                  paymentFeedback={paymentFeedback}
                  bankOptions={bankOptions}
                  onSubmit={handlePaymentSubmit}
                  onChangeType={() => setPaymentStep("choose")}
                  onAddOneTimeRow={addOneTimeRow}
                  onRemoveOneTimeRow={removeOneTimeRow}
                  onUpdateOneTimeRow={updateOneTimeRow}
                  onImportOneTimeRows={importOneTimeRows}
                  onTimeToLiveChange={(value) => setPaymentForm((prev) => ({ ...prev, timeToLive: value }))}
                  onSelectBank={selectBank}
                  onFixedAmountToggle={(e) =>
                    setPaymentForm((prev) => ({ ...prev, isAmountFixed: e.target.checked, amount: e.target.checked ? prev.amount : "" }))
                  }
                  onFixedAmountChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                  onCancel={handlePaymentFormCancel}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-20">Event not found.</div>
        )}
      </div>
    </div>
  </div>
  );
}
