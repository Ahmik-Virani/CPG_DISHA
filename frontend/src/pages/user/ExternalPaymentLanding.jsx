import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { externalLinkApi } from "../../lib/api";

function parseQuery(search) {
  const params = new URLSearchParams(search);
  return {
    amount: String(params.get("amount") || "").trim(),
    paymentRecordId: String(params.get("paymentRecordId") || "").trim(),
    merchantTxnNo: String(params.get("merchantTxnNo") || params.get("merchantTxnno") || "").trim(),
    originalTxnNo: String(params.get("originalTxnNo") || "").trim(),
    tranCtx: String(params.get("tranCtx") || params.get("tranctx") || "").trim(),
  };
}

export default function ExternalPaymentLanding() {
  const { linkId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => parseQuery(location.search), [location.search]);

  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [details, setDetails] = useState(null);
  const [email, setEmail] = useState("");
  const [selectedBank, setSelectedBank] = useState("");

  useEffect(() => {
    if (!linkId || !query.amount) {
      setError("Invalid payment link. Missing amount.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    externalLinkApi
      .resolvePublicLink(linkId, query.amount)
      .then((data) => {
        setDetails(data);
        const banks = Array.isArray(data?.banks) ? data.banks : [];
        setSelectedBank(banks[0] || "");
      })
      .catch((err) => setError(err.message || "Failed to load payment link"))
      .finally(() => setIsLoading(false));
  }, [linkId, query.amount]);

  useEffect(() => {
    const hasCallbackSignal = Boolean(
      query.paymentRecordId ||
        query.merchantTxnNo ||
        query.originalTxnNo ||
        query.tranCtx
    );

    if (!hasCallbackSignal) {
      return;
    }

    let fallbackPaymentRecordId = "";
    if (typeof window !== "undefined") {
      fallbackPaymentRecordId = String(window.localStorage.getItem("cpg:lastExternalPaymentRecordId") || "").trim();
    }

    const paymentRecordIdToVerify = query.paymentRecordId || fallbackPaymentRecordId;

    setIsVerifying(true);
    setNotice("Verifying payment status...");
    setError("");
    let didRedirect = false;

    externalLinkApi
      .verifyPublicPaymentStatus({
        paymentRecordId: paymentRecordIdToVerify,
        merchantTxnNo: query.merchantTxnNo,
        originalTxnNo: query.originalTxnNo,
        tranCtx: query.tranCtx,
      })
      .then((data) => {
        const status = String(data?.status || "pending").toLowerCase();
        if (status === "success") {
          setNotice("Payment successful. Redirecting to receipt...");
          const targetPaymentRecordId = String(data?.paymentRecord?.id || paymentRecordIdToVerify || "").trim();
          if (targetPaymentRecordId) {
            didRedirect = true;
            setTimeout(() => {
              navigate(`/pay/external/receipt/${encodeURIComponent(targetPaymentRecordId)}`, {
                replace: true,
              });
            }, 800);
            return;
          }
          setError("Payment was verified but receipt id is missing");
          setNotice("");
          return;
        }

        if (status === "failed") {
          setError("Payment failed. Please try again.");
          setNotice("");
          return;
        }

        setNotice("Payment is pending confirmation.");
      })
      .catch((err) => {
        setError(err.message || "Failed to verify payment status");
        setNotice("");
      })
      .finally(() => {
        setIsVerifying(false);
        if (!didRedirect && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("paymentRecordId");
          url.searchParams.delete("merchantTxnNo");
          url.searchParams.delete("merchantTxnno");
          url.searchParams.delete("originalTxnNo");
          url.searchParams.delete("tranCtx");
          url.searchParams.delete("tranctx");
          window.history.replaceState({}, "", url.toString());
        }
      });
  }, [navigate, query.merchantTxnNo, query.originalTxnNo, query.paymentRecordId, query.tranCtx]);

  async function handleProceed() {
    const emailValue = String(email || "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(emailValue)) {
      setError("Please enter a valid email id");
      return;
    }

    if (!selectedBank) {
      setError("Please select a bank");
      return;
    }

    const amount = Number(query.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Payment amount is invalid");
      return;
    }

    const returnURL =
      window.location.origin +
      `/pay/external/${encodeURIComponent(linkId)}?amount=${encodeURIComponent(query.amount)}`;

    setIsPaying(true);
    setError("");
    setNotice("");

    try {
      const data = await externalLinkApi.initiatePublicPayment(linkId, {
        amount,
        email: emailValue,
        bank: selectedBank,
        returnURL,
      });

      if (!data?.paymentURL) {
        throw new Error("Payment URL is missing from gateway response");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("cpg:lastExternalPaymentRecordId", String(data?.paymentRecordId || ""));
      }

      window.location.href = data.paymentURL;
    } catch (err) {
      setError(err.message || "Failed to initiate payment");
      setIsPaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/orangegrid.jpg")' }}>
      <div className="min-h-screen bg-orange-50/50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">External Payment</h1>

          {isLoading ? (
            <p className="mt-4 text-sm text-gray-500">Loading payment details...</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-gray-600">
                You are paying <span className="font-semibold text-gray-800">{details?.systemHead?.name || "System Head"}</span>
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Amount: <span className="font-semibold text-gray-800">₹{Number(details?.amount || 0).toLocaleString("en-IN")}</span>
              </p>

              <div className="mt-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email ID</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div className="mt-5">
                <p className="text-sm font-medium text-gray-700 mb-2">Select Bank</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(details?.banks) ? details.banks : []).map((bank) => {
                    const isSelected = selectedBank === bank;
                    return (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => setSelectedBank(bank)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                          isSelected
                            ? "bg-orange-500 border-orange-500 text-white"
                            : "bg-white border-gray-200 text-gray-700 hover:border-orange-300"
                        }`}
                      >
                        {bank}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
              {notice && <p className="mt-4 text-sm text-green-700">{notice}</p>}

              <button
                type="button"
                onClick={handleProceed}
                disabled={isPaying || isVerifying || isLoading}
                className="mt-6 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {isPaying ? "Redirecting..." : isVerifying ? "Verifying..." : "Proceed to Payment"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
