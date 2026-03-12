import {
  Search,
  Store,
  LogOut,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { adminApi } from "../../lib/api";

export default function Admin() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("system_head");
  const [systemHeads, setSystemHeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSystemHeads() {
      if (!token) {
        if (isMounted) {
          setSystemHeads([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        const data = await adminApi.listSystemHeads(token);
        if (isMounted) {
          setSystemHeads(Array.isArray(data.users) ? data.users : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load system heads");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSystemHeads();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const filteredHeads = useMemo(() => {
    if (!searchQuery.trim()) return systemHeads;
    const q = searchQuery.trim().toLowerCase();
    return systemHeads.filter(
      (sh) =>
        sh.name?.toLowerCase().includes(q) ||
        sh.email?.toLowerCase().includes(q)
    );
  }, [systemHeads, searchQuery]);

  return (
    <div className="min-h-screen bg-sky-50">
      <div className="flex justify-between items-center px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            <Store size={20} />
          </div>
          <div>
            <h1 className="font-semibold text-lg">IIT Hyderabad Payment Gateway</h1>
            <p className="text-sm text-gray-500">{user?.role} panel</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/change-password" className="border px-4 py-2 rounded-lg">Change Password</Link>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="border px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      <div className="bg-sky-50 px-6 py-4">
        <div className="inline-flex bg-gray-200 p-1 rounded-full gap-1">
          <button
            onClick={() => setActiveTab("system_head")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "system_head" ? "bg-white shadow text-black" : "text-gray-600 hover:text-black"
            }`}
          >
            <Store size={16} /> System Head
          </button>

          <button
            onClick={() => setActiveTab("fraud")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "fraud" ? "bg-white shadow text-black" : "text-gray-600 hover:text-black"
            }`}
          >
            <ShieldAlert size={16} /> Fraud Detection
          </button>
        </div>
      </div>

      <div className="p-8">
        {activeTab === "system_head" && (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold">Manage System Heads</h2>
              </div>

              {/* <button
                onClick={() => navigate("/admin/addMerchant")}
                className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} /> Add Merchant
              </button> */}
            </div>

            <div className="flex items-center bg-white border rounded-lg px-3 py-2 w-[350px] mb-8">
              <Search size={16} className="text-gray-500" />
              <input
                className="ml-2 outline-none w-full"
                placeholder="Search System Head..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

            {isLoading ? (
              <div className="text-center text-gray-500">Loading system heads...</div>
            ) : filteredHeads.length > 0 ? (
              <div className="grid grid-cols-3 gap-6">
                {filteredHeads.map((sh) => (
                  <div
                    key={sh.id}
                    className="group relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                  >
                    <div className="absolute top-6 right-6 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <ArrowUpRight size={18} className="text-gray-600" />
                    </div>

                    <h3 className="font-semibold text-lg mb-1">{sh.name}</h3>
                    <p className="text-gray-500 text-sm">{sh.email}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
                <p className="text-lg font-medium text-gray-700">
                  {searchQuery.trim() ? "No matching system heads" : "No system heads found"}
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "fraud" && <div className="text-center text-gray-500 text-xl mt-20">Coming Soon</div>}
      </div>
    </div>
  );
}
