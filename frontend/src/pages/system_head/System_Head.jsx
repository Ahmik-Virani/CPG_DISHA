import { History, PlusCircle, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";

export default function SystemHead() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("settlement");

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/orangegrid.jpg")' }}>
      <div className="min-h-screen bg-orange-50/50">
        <Header variant="modern" />

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
    </div>
  );
}
