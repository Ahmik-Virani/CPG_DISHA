import { ArrowLeft, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function AddMerchant() {
  const navigate = useNavigate();
  const { onboardMerchant } = useAuth();
  const [step, setStep] = useState(1);
  const [merchantName, setMerchantName] = useState("");
  const [merchantEmail, setMerchantEmail] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [createdCreds, setCreatedCreds] = useState(null);

  const submitMerchant = async () => {
    setError("");
    setStatus("");

    try {
      const data = await onboardMerchant({
        merchantName,
        email: merchantEmail,
        password: customPassword,
      });
      setCreatedCreds(data);
      setStatus("Merchant onboarded and login generated");
    } catch (err) {
      setError(err.message || "Failed to onboard merchant");
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-10">
      <div className="w-full max-w-3xl mb-6">
        <button
          onClick={() => navigate("/admin")}
          className="flex items-center gap-2 text-gray-600 hover:text-black transition"
        >
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      <div className="flex flex-col items-center mb-6">
        <div className="bg-indigo-600 text-white p-4 rounded-full mb-4">
          <Building2 size={24} />
        </div>
        <h1 className="text-2xl font-semibold">Merchant Onboarding</h1>
        <p className="text-gray-500">Join IIT Hyderabad Payment Gateway</p>
      </div>

      <div className="w-full max-w-3xl mb-8">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full bg-black transition-all duration-300 ${
              step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full"
            }`}
          />
        </div>

        <div className="flex justify-between text-sm mt-2 text-gray-600">
          <span className={step === 1 ? "text-black font-medium" : ""}>Business Info</span>
          <span className={step === 2 ? "text-black font-medium" : ""}>Bank Details</span>
          <span className={step === 3 ? "text-black font-medium" : ""}>Review</span>
        </div>
      </div>

      <div className="bg-white w-full max-w-3xl rounded-2xl shadow p-8">
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold mb-1">Business Information</h2>
            <p className="text-gray-500 mb-6">Tell us about your business</p>

            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium">Business Name *</label>
                <input
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="e.g., IIT Campus Store"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium">Business Email *</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="business@iith.ac.in"
                  value={merchantEmail}
                  onChange={(e) => setMerchantEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium">Optional Initial Password</label>
                <input
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Leave empty to auto-generate"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button onClick={() => setStep(2)} className="bg-black text-white px-6 py-2 rounded-lg">
                Next
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold mb-1">Bank Details</h2>
            <p className="text-gray-500 mb-6">(Optional in current prototype)</p>
            <div className="space-y-4">
              <input className="w-full border rounded-lg px-4 py-2" placeholder="Account Holder Name" />
              <input className="w-full border rounded-lg px-4 py-2" placeholder="Account Number" />
              <input className="w-full border rounded-lg px-4 py-2" placeholder="IFSC Code" />
            </div>

            <div className="flex justify-between mt-8">
              <button onClick={() => setStep(1)} className="border px-6 py-2 rounded-lg">Back</button>
              <button onClick={() => setStep(3)} className="bg-black text-white px-6 py-2 rounded-lg">Next</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold mb-6">Review & Submit</h2>
            <p className="text-gray-500 mb-2">Business: {merchantName || "-"}</p>
            <p className="text-gray-500 mb-6">Email: {merchantEmail || "-"}</p>

            {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
            {status ? <p className="text-sm text-green-700 mb-4">{status}</p> : null}

            {createdCreds ? (
              <div className="mb-6 border rounded-lg p-4 bg-slate-50">
                <p className="font-medium">Merchant login generated</p>
                <p>Email: {createdCreds.user?.email}</p>
                <p className="text-amber-700 font-medium">Password: {createdCreds.generatedPassword}</p>
                <p className="text-xs text-gray-600 mt-2">Merchant should change password after first login.</p>
              </div>
            ) : null}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="border px-6 py-2 rounded-lg">Back</button>
              <button className="bg-green-600 text-white px-6 py-2 rounded-lg" onClick={submitMerchant}>
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
