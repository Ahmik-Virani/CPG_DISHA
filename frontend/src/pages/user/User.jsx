import {
  Store,
  Utensils,
  Book,
  Hospital,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function User() {
  const navigate = useNavigate();

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
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-100 transition"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {/* ================= CONTENT ================= */}
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">
            Available Merchants
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {merchants.map((m) => (
            <div
              key={m.name}
              className="group relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              {/* Hover Arrow */}
              <div className="absolute top-6 right-6 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                <ArrowUpRight size={18} className="text-gray-600" />
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
      </div>
    </div>
  );
}