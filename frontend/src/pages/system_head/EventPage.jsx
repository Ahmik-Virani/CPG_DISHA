import { useEffect, useState } from "react";
import { ArrowLeft, Store, LogOut } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { eventApi } from "../../lib/api";

const BANK_OPTIONS = ["ICICI", "SBI", "HDFC"];

function normalizeRollNoInput(value) {
  return String(value || "").toUpperCase().replace(/\s+/g, "").trim();
}

function createOneTimeRow(rowId) {
  return {
    rowKey: rowId,
    rollNo: "",
    amount: "",
  };
}

function formatPaymentType(type) {
  if (type === "one_time") {
    return "One-Time";
  }
  if (type === "fixed") {
    return "Fixed";
  }
  return "Unknown";
}

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
                <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="text-sm font-semibold text-gray-800">Request Details</h3>
                  <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                    <p>
                      <span className="font-medium">Request Type:</span> {formatPaymentType(paymentRequest.type)}
                    </p>
                    <p>
                      <span className="font-medium">Banks:</span> {Array.isArray(paymentRequest.banks) && paymentRequest.banks.length ? paymentRequest.banks.join(", ") : "-"}
                    </p>

                    {paymentRequest.type === "one_time" ? (
                      <>
                        <p>
                          <span className="font-medium">Time To Live:</span> {paymentRequest.timeToLive ? new Date(paymentRequest.timeToLive).toLocaleString() : "-"}
                        </p>
                        <p>
                          <span className="font-medium">Rows:</span> {Array.isArray(paymentRequest.entries) ? paymentRequest.entries.length : 1}
                        </p>
                        <div className="md:col-span-2 overflow-x-auto">
                          <div className="max-h-105 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-gray-100 text-gray-700">
                              <tr>
                                <th className="border border-gray-200 px-3 py-2">S.No</th>
                                <th className="border border-gray-200 px-3 py-2">Roll No</th>
                                <th className="border border-gray-200 px-3 py-2">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(Array.isArray(paymentRequest.entries) && paymentRequest.entries.length
                                ? paymentRequest.entries
                                : [{ rollNo: paymentRequest.rollNo, amount: paymentRequest.amount }]
                              ).map((entry, index) => (
                                <tr key={`${entry.rollNo || "row"}-${entry.amount || index}-${index}`}>
                                  <td className="border border-gray-200 px-3 py-2">{index + 1}</td>
                                  <td className="border border-gray-200 px-3 py-2">{entry.rollNo || "-"}</td>
                                  <td className="border border-gray-200 px-3 py-2">
                                    {typeof entry.amount === "number" ? `\u20B9${entry.amount}` : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        </div>
                      </>
                    ) : null}

                    {paymentRequest.type === "fixed" ? (
                      <>
                        <p>
                          <span className="font-medium">Is Amount Fixed:</span> {paymentRequest.isAmountFixed ? "Yes" : "No"}
                        </p>
                        <p>
                          <span className="font-medium">Amount:</span>{" "}
                          {paymentRequest.isAmountFixed && typeof paymentRequest.amount === "number"
                            ? `\u20B9${paymentRequest.amount}`
                            : "Variable"}
                        </p>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {paymentStep === "choose" ? (
                <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-700">Choose request type</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => choosePaymentType("one_time")}
                      className="rounded-lg border bg-white px-4 py-2"
                    >
                      One-Time
                    </button>
                    <button
                      type="button"
                      onClick={() => choosePaymentType("fixed")}
                      className="rounded-lg border bg-white px-4 py-2"
                    >
                      Fixed
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStep("idle");
                        setPaymentType("");
                      }}
                      className="rounded-lg border px-4 py-2 text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {paymentStep === "form" ? (
                <form onSubmit={handlePaymentSubmit} className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-700">
                      Create {paymentType === "one_time" ? "One-Time" : "Fixed"} Payment Request
                    </p>
                    <button
                      type="button"
                      onClick={() => setPaymentStep("choose")}
                      className="rounded-lg border px-3 py-1 text-sm"
                    >
                      Change Type
                    </button>
                  </div>

                  {paymentType === "one_time" ? (
                    <div className="mt-4 grid gap-4">
                      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                        <div className="max-h-105 overflow-y-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-gray-100 text-gray-700">
                            <tr>
                              <th className="border-b border-gray-200 px-3 py-2">S.No</th>
                              <th className="border-b border-gray-200 px-3 py-2">Roll No</th>
                              <th className="border-b border-gray-200 px-3 py-2">Amount</th>
                              <th className="border-b border-gray-200 px-3 py-2">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentForm.oneTimeRows.map((row, index) => (
                              <tr key={row.rowKey}>
                                <td className="border-b border-gray-200 px-3 py-2">{index + 1}</td>
                                <td className="border-b border-gray-200 px-3 py-2">
                                  <input
                                    type="text"
                                    value={row.rollNo}
                                    onChange={(e) => updateOneTimeRow(row.rowKey, "rollNo", e.target.value)}
                                    className="w-full rounded-lg border px-3 py-2"
                                    placeholder="CS24BTECH11001"
                                  />
                                </td>
                                <td className="border-b border-gray-200 px-3 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.amount}
                                    onChange={(e) => updateOneTimeRow(row.rowKey, "amount", e.target.value)}
                                    className="w-full rounded-lg border px-3 py-2"
                                  />
                                </td>
                                <td className="border-b border-gray-200 px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => removeOneTimeRow(row.rowKey)}
                                    disabled={paymentForm.oneTimeRows.length <= 1}
                                    className="rounded-lg border px-3 py-1 text-xs disabled:opacity-50"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={addOneTimeRow}
                          className="rounded-lg border px-3 py-2 text-sm"
                        >
                          Add Roll No
                        </button>
                      </div>

                      <label className="flex flex-col gap-1 text-sm md:col-span-2">
                        Time To Live
                        <input
                          type="datetime-local"
                          value={paymentForm.timeToLive}
                          onChange={(e) => setPaymentForm((prev) => ({ ...prev, timeToLive: e.target.value }))}
                          className="rounded-lg border px-3 py-2"
                          required
                        />
                      </label>
                    </div>
                  ) : null}

                  {paymentType === "fixed" ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
                        <input
                          type="checkbox"
                          checked={paymentForm.isAmountFixed}
                          onChange={(e) =>
                            setPaymentForm((prev) => ({
                              ...prev,
                              isAmountFixed: e.target.checked,
                              amount: e.target.checked ? prev.amount : "",
                            }))
                          }
                        />
                        Fix amount for this request
                      </label>

                      {paymentForm.isAmountFixed ? (
                        <label className="flex flex-col gap-1 text-sm md:col-span-2">
                          Amount
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                            className="rounded-lg border px-3 py-2"
                            required
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <p className="text-sm">Banks</p>
                    <div className="mt-2 flex flex-wrap gap-4">
                      {BANK_OPTIONS.map((bank) => (
                        <label key={bank} className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={paymentForm.banks.includes(bank)}
                            onChange={() => toggleBank(bank)}
                          />
                          {bank}
                        </label>
                      ))}
                    </div>
                  </div>

                  {paymentFeedback.message ? (
                    <p className={"mt-4 text-sm " + (paymentFeedback.type === "error" ? "text-red-600" : "text-green-700")}>
                      {paymentFeedback.message}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="submit" disabled={isActing} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-60">
                      {isActing ? "Submitting..." : "Submit Request"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStep("choose");
                        setPaymentFeedback({ type: "", message: "" });
                      }}
                      className="rounded-lg border px-4 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
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
