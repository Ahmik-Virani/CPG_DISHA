import { useEffect, useState } from "react";
import { ArrowLeft, Store, LogOut } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { eventApi } from "../../lib/api";
import { createOneTimeRow, normalizeRollNoInput } from "./utils/oneTimeCsv";
import { BANK_OPTIONS, formatPaymentType } from "./utils/paymentRequestUi";
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
        if (isMounted) {
          setIsLoading(false);
          setIsLoadingPaymentRequest(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setIsLoadingPaymentRequest(true);
        }
        const [eventData, paymentData] = await Promise.all([
          eventApi.getOne(token, eventId),
          eventApi.getLatestPaymentRequest(token, eventId),
        ]);
        if (isMounted) {
          setEvent(eventData.event || null);
          setPaymentRequest(paymentData.paymentRequest || null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load event");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsLoadingPaymentRequest(false);
        }
      }
    }

    loadEvent();

    return () => {
      isMounted = false;
    };
  }, [eventId, token]);

  const handleMarkDone = async () => {
    if (!event?.isOngoing) {
      return;
    }

    const confirmed = window.confirm("Mark this event as done?");
    if (!confirmed) {
      return;
    }

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
    const confirmed = window.confirm("Delete this event? This cannot be undone.");
    if (!confirmed) {
      return;
    }

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
    setPaymentForm({
      oneTimeRows: [createOneTimeRow(1)],
      banks: [],
      amount: "",
      timeToLive: "",
      isAmountFixed: false,
    });
    setNextOneTimeRowId(2);
  };

  const openPaymentChooser = () => {
    if (paymentRequest) {
      return;
    }
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

  const toggleBank = (bank) => {
    setPaymentForm((prev) => {
      const hasBank = prev.banks.includes(bank);
      return {
        ...prev,
        banks: hasBank ? prev.banks.filter((item) => item !== bank) : [...prev.banks, bank],
      };
    });
  };

  const addOneTimeRow = () => {
    setPaymentForm((prev) => ({
      ...prev,
      oneTimeRows: [...prev.oneTimeRows, createOneTimeRow(nextOneTimeRowId)],
    }));
    setNextOneTimeRowId((prev) => prev + 1);
  };

  const removeOneTimeRow = (rowId) => {
    setPaymentForm((prev) => {
      if (prev.oneTimeRows.length <= 1) {
        return prev;
      }

      return {
        ...prev,
        oneTimeRows: prev.oneTimeRows.filter((row) => row.rowKey !== rowId),
      };
    });
  };

  const updateOneTimeRow = (rowId, field, value) => {
    setPaymentForm((prev) => ({
      ...prev,
      oneTimeRows: prev.oneTimeRows.map((row) => {
        if (row.rowKey !== rowId) {
          return row;
        }

        return {
          ...row,
          [field]: field === "rollNo" ? normalizeRollNoInput(value) : value,
        };
      }),
    }));
  };

  const importOneTimeRows = (rows) => {
    const maxRowKey = rows.reduce((max, row) => {
      const key = Number(row?.rowKey);
      return Number.isFinite(key) ? Math.max(max, key) : max;
    }, 0);

    setPaymentForm((prev) => ({
      ...prev,
      oneTimeRows: rows,
    }));
    setNextOneTimeRowId(maxRowKey + 1);
  };

  const handlePaymentFormCancel = () => {
    setPaymentStep("choose");
    setPaymentFeedback({ type: "", message: "" });
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();

    if (!paymentType) {
      setPaymentFeedback({ type: "error", message: "Please choose a payment request type." });
      return;
    }

    if (!paymentForm.banks.length) {
      setPaymentFeedback({ type: "error", message: "Select at least one bank." });
      return;
    }

    const payload = {
      type: paymentType,
      banks: paymentForm.banks,
    };

    if (paymentType === "one_time") {
      const entries = paymentForm.oneTimeRows
        .map((row) => ({
          rollNo: normalizeRollNoInput(row.rollNo),
          amount: Number(row.amount),
        }))
        .filter((entry) => entry.rollNo || Number.isFinite(entry.amount));
      const ttlDate = new Date(paymentForm.timeToLive);

      const hasInvalidEntry = entries.some(
        (entry) => !entry.rollNo || !Number.isFinite(entry.amount) || entry.amount <= 0
      );
      const uniqueRollNos = new Set(entries.map((entry) => entry.rollNo));
      const hasDuplicateRollNos = uniqueRollNos.size !== entries.length;

      if (!entries.length || hasInvalidEntry || Number.isNaN(ttlDate.getTime())) {
        setPaymentFeedback({
          type: "error",
          message: "Each row needs a valid Roll No and amount greater than 0, along with valid time to live.",
        });
        return;
      }

      if (hasDuplicateRollNos) {
        setPaymentFeedback({
          type: "error",
          message: "Duplicate roll numbers are not allowed.",
        });
        return;
      }

      payload.entries = entries;
      payload.timeToLive = ttlDate.toISOString();
    }

    if (paymentType === "fixed") {
      payload.isAmountFixed = paymentForm.isAmountFixed;

      if (paymentForm.isAmountFixed) {
        const amount = Number(paymentForm.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          setPaymentFeedback({
            type: "error",
            message: "Amount must be greater than 0 when fixed amount is enabled.",
          });
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
    <div className="min-h-screen bg-sky-50">
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

      <div className="p-6 md:p-8">
        <button
          type="button"
          onClick={() => navigate("/system_head/manage-event")}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-black"
        >
          <ArrowLeft size={16} /> Back to Events
        </button>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {isLoading ? (
            <p className="text-gray-500">Loading event...</p>
          ) : event ? (
            <>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">{event.name}</h2>
                  <p className="mt-2 text-sm text-gray-500">Status: {event.isOngoing ? "Ongoing" : "Done"}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleMarkDone}
                    disabled={isActing || !event.isOngoing}
                    className={
                      "rounded-lg border px-4 py-2 disabled:opacity-60 " +
                      (event.isOngoing ? "" : "border-green-600 text-green-600")
                    }
                  >
                    {event.isOngoing ? "Mark Event as Done" : "Done"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isActing}
                    className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-60"
                  >
                    Delete Event
                  </button>
                </div>
              </div>

              {event.description ? <p className="mt-6 text-gray-700">{event.description}</p> : null}

              {canShowPaymentActions ? (
                <div className="mt-8 flex flex-wrap gap-3">
                  {paymentRequest ? (
                    <button
                      type="button"
                      onClick={() => setShowPaymentDetails((prev) => !prev)}
                      className="rounded-lg border px-4 py-2"
                    >
                      {showPaymentDetails ? "Hide Request Details" : "View Request Details"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openPaymentChooser}
                      disabled={isLoadingPaymentRequest}
                      className="rounded-lg border px-4 py-2 disabled:opacity-60"
                    >
                      {isLoadingPaymentRequest ? "Loading..." : "Request Payment"}
                    </button>
                  )}
                  <button type="button" className="rounded-lg border px-4 py-2">
                    Check Payment Status
                  </button>
                </div>
              ) : null}

              {paymentRequest && showPaymentDetails ? (
                <PaymentRequestDetails
                  paymentRequest={paymentRequest}
                  formatPaymentType={formatPaymentType}
                />
              ) : null}

              {paymentStep === "choose" ? (
                <PaymentTypeChooser
                  onChoosePaymentType={choosePaymentType}
                  onCancel={() => {
                    setPaymentStep("idle");
                    setPaymentType("");
                  }}
                />
              ) : null}

              {paymentStep === "form" ? (
                <PaymentRequestForm
                  paymentType={paymentType}
                  paymentForm={paymentForm}
                  isActing={isActing}
                  paymentFeedback={paymentFeedback}
                  bankOptions={BANK_OPTIONS}
                  onSubmit={handlePaymentSubmit}
                  onChangeType={() => setPaymentStep("choose")}
                  onAddOneTimeRow={addOneTimeRow}
                  onRemoveOneTimeRow={removeOneTimeRow}
                  onUpdateOneTimeRow={updateOneTimeRow}
                  onImportOneTimeRows={importOneTimeRows}
                  onTimeToLiveChange={(value) =>
                    setPaymentForm((prev) => ({ ...prev, timeToLive: value }))
                  }
                  onToggleBank={toggleBank}
                  onFixedAmountToggle={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      isAmountFixed: e.target.checked,
                      amount: e.target.checked ? prev.amount : "",
                    }))
                  }
                  onFixedAmountChange={(e) =>
                    setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  onCancel={handlePaymentFormCancel}
                />
              ) : null}
            </>
          ) : (
            <p className="text-gray-500">Event not found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
