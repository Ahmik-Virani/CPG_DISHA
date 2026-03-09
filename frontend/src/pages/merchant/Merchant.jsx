import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Merchant() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-sky-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Merchant Dashboard</h1>
            <p className="text-gray-600">{user?.email}</p>
          </div>
          <button
            className="border px-3 py-2 rounded-lg"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            Logout
          </button>
        </div>

        <p className="text-gray-700 mb-4">Your merchant workspace is ready. Add merchant widgets here.</p>

        <div className="flex gap-4 text-sm">
          <Link to="/change-password" className="text-blue-600">Change Password</Link>
        </div>
      </div>
    </div>
  );
}
