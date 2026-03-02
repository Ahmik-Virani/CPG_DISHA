import {
  ArrowLeft,
  Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function AddMerchant() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center py-10">

      {/* Back Button */}
      <div className="w-full max-w-3xl mb-6">
        <button
          onClick={() => navigate("/admin")}
          className="flex items-center gap-2 text-gray-600 hover:text-black transition"
        >
          <ArrowLeft size={18} />
          Back
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="bg-indigo-600 text-white p-4 rounded-full mb-4">
          <Building2 size={24} />
        </div>

        <h1 className="text-2xl font-semibold">
          Merchant Onboarding
        </h1>

        <p className="text-gray-500">
          Join IIT Hyderabad Payment Gateway
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-3xl mb-8">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full bg-black transition-all duration-300 ${
              step === 1
                ? "w-1/3"
                : step === 2
                ? "w-2/3"
                : "w-full"
            }`}
          />
        </div>

        <div className="flex justify-between text-sm mt-2 text-gray-600">
          <span className={step === 1 ? "text-black font-medium" : ""}>
            Business Info
          </span>
          <span className={step === 2 ? "text-black font-medium" : ""}>
            Bank Details
          </span>
          <span className={step === 3 ? "text-black font-medium" : ""}>
            Review
          </span>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow p-8">

        {/* ================= STEP 1 ================= */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold mb-1">
              Business Information
            </h2>
            <p className="text-gray-500 mb-6">
              Tell us about your business
            </p>

            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium">
                  Business Name *
                </label>
                <input
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="e.g., IIT Campus Store"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium">
                  Business Type *
                </label>
                <select className="w-full border rounded-lg px-4 py-2">
                  <option>Select business type</option>
                  <option>Food & Dining</option>
                  <option>Healthcare</option>
                  <option>Education</option>
                  <option>Administration</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium">
                  Business Email *
                </label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="business@iith.ac.in"
                />
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button
                onClick={() => setStep(2)}
                className="bg-black text-white px-6 py-2 rounded-lg"
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* ================= STEP 2 ================= */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold mb-1">
              Bank Details
            </h2>
            <p className="text-gray-500 mb-6">
              Provide merchant bank information
            </p>

            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium">
                  Account Holder Name *
                </label>
                <input
                  className="w-full border rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium">
                  Account Number *
                </label>
                <input
                  className="w-full border rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium">
                  IFSC Code *
                </label>
                <input
                  className="w-full border rounded-lg px-4 py-2"
                />
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep(1)}
                className="border px-6 py-2 rounded-lg"
              >
                Back
              </button>

              <button
                onClick={() => setStep(3)}
                className="bg-black text-white px-6 py-2 rounded-lg"
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* ================= STEP 3 ================= */}
        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold mb-6">
              Review & Submit
            </h2>

            <p className="text-gray-500 mb-8">
              Please review the information before submitting.
            </p>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="border px-6 py-2 rounded-lg"
              >
                Back
              </button>

              <button
                className="bg-green-600 text-white px-6 py-2 rounded-lg"
                onClick={() => alert("Merchant Submitted Successfully")}
              >
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}