import {
  Plus,
  Search,
  Store,
  Utensils,
  Book,
  Hospital,
  LogOut,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("merchants");

  const merchants = [
    {
      name: "IIT Mess",
      desc: "Dining & Cafeteria",
      icon: "mess",
      color: "bg-orange-500",
    },
    {
      name: "Campus Hospital",
      desc: "Medical Services",
      icon: "hospital",
      color: "bg-red-500",
    },
    {
      name: "Central Library",
      desc: "Books & Fees",
      icon: "library",
      color: "bg-blue-500",
    },
    {
      name: "Hostel Office",
      desc: "Accommodation & Fees",
      icon: "building",
      color: "bg-green-500",
    },
  ];

  const getIcon = (type) => {
    if (type === "mess") return <Utensils />;
    if (type === "hospital") return <Hospital />;
    if (type === "library") return <Book />;
    return <Store />;
  };

  return (
    <div className="min-h-screen bg-sky-50">
      {/* ================= HEADER ================= */}
      <div className="flex justify-between items-center px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            <Store size={20} />
          </div>

          <div>
            <h1 className="font-semibold text-lg">
              IIT Hyderabad Payment Gateway
            </h1>
            <p className="text-sm text-gray-500">Admin Panel</p>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="border px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {/* ================= MODERN TABS ================= */}
      <div className="bg-sky-50 px-6 py-4">
        <div className="inline-flex bg-gray-200 p-1 rounded-full gap-1">
          {/* Merchants Tab */}
          <button
            onClick={() => setActiveTab("merchants")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "merchants"
                ? "bg-white shadow text-black"
                : "text-gray-600 hover:text-black"
            }`}
          >
            <Store size={16} />
            Merchants
          </button>

          {/* Fraud Detection Tab */}
          <button
            onClick={() => setActiveTab("fraud")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "fraud"
                ? "bg-white shadow text-black"
                : "text-gray-600 hover:text-black"
            }`}
          >
            <ShieldAlert size={16} />
            Fraud Detection
          </button>
        </div>
      </div>

      {/* ================= CONTENT ================= */}
      <div className="p-8">
        {/* ================= MERCHANTS TAB ================= */}
        {activeTab === "merchants" && (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold">
                  Manage Merchants
                </h2>
                <p className="text-gray-500">
                  Add, remove or edit campus merchants
                </p>
              </div>

              <button
                onClick={() => navigate("/admin/addMerchant")}
                className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                Add Merchant
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center bg-white border rounded-lg px-3 py-2 w-[350px] mb-8">
              <Search size={16} className="text-gray-500" />
              <input
                className="ml-2 outline-none w-full"
                placeholder="Search merchants..."
              />
            </div>

            {/* Cards */}
            <div className="grid grid-cols-3 gap-6">
              {merchants.map((m, i) => (
                <div
                  key={i}
                  className="group relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                >
                  {/* Hover Arrow */}
                  <div className="absolute top-6 right-6 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    <ArrowUpRight
                      size={18}
                      className="text-gray-600"
                    />
                  </div>

                  {/* Icon */}
                  <div
                    className={`${m.color} text-white w-12 h-12 flex items-center justify-center rounded-xl mb-4`}
                  >
                    {getIcon(m.icon)}
                  </div>

                  {/* Content */}
                  <h3 className="font-semibold text-lg mb-1">
                    {m.name}
                  </h3>

                  <p className="text-gray-500 text-sm">
                    {m.desc}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ================= FRAUD TAB ================= */}
        {activeTab === "fraud" && (
          <div className="text-center text-gray-500 text-xl mt-20">
            Coming Soon 🚀
          </div>
        )}
      </div>
    </div>
  );
}