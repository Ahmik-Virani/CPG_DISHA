import { ArrowLeft, FileText, ReceiptIndianRupee } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

function formatAmount(request) {
  if (request?.isAmountFixed === false) {
    return "Variable Amount";
  }

  const amount = Number(request?.amount);
  if (!Number.isFinite(amount)) {
    return "Not available";
  }

  return `\u20B9${amount}`;
}

function formatDeadline(request) {
  const rawDeadline = request?.timeToLive;
  if (!rawDeadline) {
    return "Not specified";
  }

  const deadline = new Date(rawDeadline);
  if (!Number.isFinite(deadline.getTime())) {
    return "Not specified";
  }

  return deadline.toLocaleString();
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase() === "paid" ? "paid" : "pending";
}

export default function PaymentDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const request = location.state?.request || null;

  if (!request) {
    return (
      <div className="min-h-screen bg-sky-50 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Payment Details</h1>
          <p className="mt-3 text-gray-600">
            Payment details are unavailable. Please open this page from Pending or Optional Transactions.
          </p>
          <button
            type="button"
            onClick={() => navigate("/user")}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border px-4 py-2"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const status = normalizeStatus(request.status);

  return (
    <div className="min-h-screen bg-sky-50 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/user" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-black">
          <ArrowLeft size={16} /> Back to Transactions
        </Link>

        <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Payment Details</h1>

          <div className="mt-6 grid gap-4 text-sm md:text-base">
            <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
              <p className="text-gray-500">Name of Event</p>
              <p className="font-medium text-gray-900 mt-1">{request.eventName || "Unknown Event"}</p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
              <p className="text-gray-500">Description of Event</p>
              <p className="font-medium text-gray-900 mt-1">{request.eventDescription || "No event description available"}</p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
              <p className="text-gray-500">Deadline</p>
              <p className="font-medium text-gray-900 mt-1">{formatDeadline(request)}</p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
              <p className="text-gray-500">Amount</p>
              <p className="font-medium text-gray-900 mt-1">{formatAmount(request)}</p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
              <p className="text-gray-500">Status</p>
              <span
                className={`mt-1 inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${
                  status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {status}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-5 py-2.5"
            >
              <ReceiptIndianRupee size={16} /> Pay Now (Static)
            </button>

            {status === "paid" ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border px-5 py-2.5"
              >
                <FileText size={16} /> Open Receipt (Static)
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
