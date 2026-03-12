import { Clock, History, PlusCircle, Store, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function SystemHead() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");

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

      <div className="bg-sky-50 px-6 py-4">
        <div className="inline-flex bg-gray-200 p-1 rounded-full gap-1 flex-wrap">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "pending"
                ? "bg-white shadow text-black"
                : "text-gray-600 hover:text-black"
            }`}
          >
            <Clock size={16} /> Requested Transactions
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

          <button
            onClick={() => setActiveTab("create-payment")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "create-payment"
                ? "bg-white shadow text-black"
                : "text-gray-600 hover:text-black"
            }`}
          >
            <PlusCircle size={16} /> Manage Events
          </button>
        </div>
      </div>

      <div className="p-8">
        {activeTab === "pending" && (
          <div className="text-center text-gray-500 text-xl mt-20">No pending transactions</div>
        )}

        {activeTab === "history" && (
          <div className="text-center text-gray-500 text-xl mt-20">No transaction history</div>
        )}

        {activeTab === "create-payment" && (
          <div className="max-w-2xl bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-2">Create Payment</h2>
            <p className="text-gray-500 mb-6">
              Static preview only. Submission and redirects are disabled for now.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Student Roll Number</label>
                <input
                  type="text"
                  placeholder="e.g. CS22BTECH11001"
                  className="w-full border rounded-lg px-3 py-2 outline-none"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Amount</label>
                <input
                  type="text"
                  placeholder="e.g. 2500"
                  className="w-full border rounded-lg px-3 py-2 outline-none"
                  readOnly
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Payment Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Hostel Fee"
                  className="w-full border rounded-lg px-3 py-2 outline-none"
                  readOnly
                />
              </div>
            </div>

            <button
              type="button"
              className="mt-6 bg-black text-white px-5 py-2.5 rounded-lg opacity-80 cursor-not-allowed"
              disabled
            >
              Create Payment (Static)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
