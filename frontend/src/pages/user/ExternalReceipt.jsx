import { useEffect, useState } from "react";
import { ArrowLeft, Download, CheckCircle2, Building2, User, Calendar, Hash } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../../components/Header";
import { externalLinkApi } from "../../lib/api";

export default function ExternalReceipt() {
  const { paymentRecordId } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!paymentRecordId) {
      setError("Receipt id is missing");
      setLoading(false);
      return;
    }

    externalLinkApi
      .getPublicReceipt(paymentRecordId)
      .then((data) => {
        if (data?.receipt) {
          setReceipt(data.receipt);
        } else {
          setError("Receipt not found");
        }
      })
      .catch((err) => setError(err.message || "Failed to load receipt"))
      .finally(() => setLoading(false));
  }, [paymentRecordId]);

  const handleDownload = () => {
    if (!receipt) return;

    const printWindow = window.open("", "_blank");
    const receiptData = receipt;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>External Payment Receipt</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #ea580c; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #ea580c; margin: 0; }
          .header p { color: #666; margin: 10px 0 0; }
          .success-badge { text-align: center; margin: 20px 0; }
          .success-badge span { background: #22c55e; color: white; padding: 8px 24px; border-radius: 20px; font-weight: bold; }
          .details { background: #f9fafb; padding: 20px; border-radius: 8px; }
          .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #6b7280; font-weight: 500; }
          .detail-value { color: #111827; font-weight: 600; }
          .footer { text-align: center; margin-top: 40px; color: #9ca3af; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>External Payment Receipt</h1>
          <p>${receiptData.systemHead?.name || "System Head"}</p>
        </div>
        <div class="success-badge">
          <span>✓ PAYMENT ${String(receiptData.status || "pending").toUpperCase()}</span>
        </div>
        <div class="details">
          <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value">₹${Number(receiptData.transaction?.amount || 0).toLocaleString("en-IN")}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Transaction ID</span>
            <span class="detail-value">${receiptData.transaction?.transaction_id || "N/A"}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Bank</span>
            <span class="detail-value">${receiptData.bank?.bank_name || "N/A"}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Payer Email</span>
            <span class="detail-value">${receiptData.student?.email || "N/A"}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${receiptData.createdAt ? new Date(receiptData.createdAt).toLocaleString("en-IN") : "N/A"}</span>
          </div>
        </div>
        <div class="footer">
          <p>This is a system-generated receipt.</p>
          <p>Generated on ${new Date().toLocaleString("en-IN")}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 p-8 flex items-center justify-center">
        <p className="text-gray-500">Loading receipt...</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-orange-50 p-8">
        <Header variant="modern" />
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mt-8">
          <h1 className="text-xl font-semibold text-gray-900">Receipt Unavailable</h1>
          <p className="mt-2 text-sm text-gray-500">{error || "Unable to load receipt details."}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-5 inline-flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={15} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const status = String(receipt.status || "").toLowerCase();
  const isSuccessful = status === "success" || status === "paid";

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/orangegrid.jpg")' }}>
      <div className="min-h-screen bg-orange-50/50">
        <Header variant="modern" />

        <div className="relative px-6 mt-3 z-20">
          <div className="inline-flex items-center rounded-full bg-white border border-gray-200 px-4 py-2 shadow-sm hover:shadow-md transition-shadow">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={15} /> Back
            </Link>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-8">
          {isSuccessful && (
            <div className="bg-linear-to-r from-green-500 to-green-400 rounded-2xl p-6 mb-6 shadow-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-white" size={32} />
                <div>
                  <h2 className="text-xl font-bold text-white">Payment Successful</h2>
                  <p className="text-green-100 text-sm">Your external transaction has been completed</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-linear-to-br from-orange-500 to-orange-300 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white/80 uppercase tracking-wide">External Payment Receipt</p>
                  <h1 className="text-2xl font-bold text-white mt-1">{receipt.systemHead?.name || "System Head"}</h1>
                </div>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  <Download size={16} /> Download
                </button>
              </div>
            </div>

            <div className="px-6 py-8">
              <div className="space-y-6">
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-1">Amount Paid</p>
                  <p className="text-4xl font-bold text-gray-900">
                    ₹{Number(receipt.transaction?.amount || 0).toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      <Hash className="text-orange-500" size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase font-medium">Transaction ID</p>
                      <p className="text-sm font-mono text-gray-900 mt-0.5">
                        {receipt.transaction?.transaction_id || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      <Building2 className="text-orange-500" size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase font-medium">Bank</p>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {receipt.bank?.bank_name || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      <CheckCircle2 className="text-orange-500" size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase font-medium">Status</p>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize mt-1 ${
                          isSuccessful
                            ? "bg-green-100 text-green-700"
                            : status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      <Calendar className="text-orange-500" size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase font-medium">Transaction Date</p>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {receipt.createdAt ? new Date(receipt.createdAt).toLocaleString("en-IN") : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      <User className="text-orange-500" size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase font-medium">Paid By</p>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {receipt.student?.email || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-400 text-white px-6 py-3 font-semibold text-sm shadow-md hover:bg-orange-500 transition-all"
                >
                  <Download size={16} /> Download Receipt
                </button>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Close
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
