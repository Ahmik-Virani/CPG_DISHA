import { History, PlusCircle, Store, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function SystemHead() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("settlement");

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
            onClick={() => {
              setActiveTab("manage-events");
              navigate("/system_head/manage-event");
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "manage-events"
                ? "bg-white shadow text-black"
                : "text-gray-600 hover:text-black"
            }`}
          >
            <PlusCircle size={16} /> Manage Events
          </button>

          <button
            onClick={() => setActiveTab("settlement")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "settlement"
                ? "bg-white shadow text-black"
                : "text-gray-600 hover:text-black"
            }`}
          >
            <History size={16} /> Settlement History
          </button>

        </div>
      </div>

      <div className="p-8">

        {activeTab === "settlement" && (
          <div className="text-center text-gray-500 text-xl mt-20">No settlement history</div>
        )}
      </div>
    </div>
  );
}
