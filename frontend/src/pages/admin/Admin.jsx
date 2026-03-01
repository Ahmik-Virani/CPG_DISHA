import { Plus, Search, Store, Utensils, Book, Hospital, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Admin() {

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
  ];

  const getIcon = (type) => {
    if (type === "mess") return <Utensils />;
    if (type === "hospital") return <Hospital />;
    if (type === "library") return <Book />;
    return <Store />;
  };

  return (
    <div className="min-h-screen bg-sky-50">

      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b bg-white">

        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            <Store size={20} />
          </div>

          <div>
            <h1 className="font-semibold text-lg">
              IIT Hyderabad Payment Gateway
            </h1>
            <p className="text-sm text-gray-500">
              Admin Panel
            </p>
          </div>
        </div>

        <div className="flex gap-3">

          <button
            onClick={() => navigate("/admin/addMerchant")}
            className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={16} />
            Add Merchant
          </button>

          <button
            onClick={() => navigate("/")}
            className="border px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <LogOut size={16} />
            Logout
          </button>

        </div>
      </div>


      {/* Content */}
      <div className="p-8">

        <h2 className="text-2xl font-semibold mb-1">
          Manage Merchants
        </h2>

        <p className="text-gray-500 mb-6">
          Add, remove or edit campus merchants
        </p>


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
              className="bg-white p-6 rounded-xl shadow hover:shadow-2xl transition-shadow cursor-pointer"
            >

              <div
                className={`${m.color} text-white w-12 h-12 flex items-center justify-center rounded-lg mb-4`}
              >
                {getIcon(m.icon)}
              </div>

              <h3 className="font-semibold text-lg">
                {m.name}
              </h3>

              <p className="text-gray-500">
                {m.desc}
              </p>

            </div>
          ))}

        </div>

      </div>

    </div>
  );
}