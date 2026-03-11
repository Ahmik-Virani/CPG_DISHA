import { LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function User() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-sky-50">
      <div className="flex justify-between items-center px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-semibold text-lg">IIT Hyderabad Payment Gateway</h1>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <Link to="/change-password" className="border px-4 py-2 rounded-lg">Change Password</Link>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="border px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div className="p-8">
        <h2 className="text-3xl font-semibold">Hello, {user?.name}!</h2>
        <p className="text-gray-500 mt-2">Welcome to your dashboard.</p>
      </div>
    </div>
  );
}
