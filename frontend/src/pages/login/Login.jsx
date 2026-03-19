import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, User, Settings } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getRoleHomePath } from "../../auth/roleHome";

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("user");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const user = await login(email, password);

      if (user.role !== selectedRole) {
        logout();
        setError(`This account is not a ${selectedRole}. Please select the correct role.`);
        return;
      }

      navigate(user.mustChangePassword ? "/change-password" : getRoleHomePath(user.role));
    } catch (err) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-sky-100 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow">
        <div className="flex justify-center mb-4">
          <div className="bg-indigo-500 text-white p-3 rounded-full">
            <Shield size={24} />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-center">IIT Payment Gateway</h1>
        <p className="text-center text-gray-500 mb-6">Sign in to your account</p>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedRole === "user"
                  ? "bg-white shadow text-black"
                  : "text-gray-500 hover:text-black"
              }`}
              onClick={() => setSelectedRole("user")}
            >
              <User size={16} /> User
            </button>
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedRole === "system_head"
                  ? "bg-white shadow text-black"
                  : "text-gray-500 hover:text-black"
              }`}
              onClick={() => setSelectedRole("system_head")}
            >
              <Settings size={16} /> System Head
            </button>
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedRole === "admin"
                  ? "bg-white shadow text-black"
                  : "text-gray-500 hover:text-black"
              }`}
              onClick={() => setSelectedRole("admin")}
            >
              <Shield size={16} /> Admin
            </button>
          </div>

          <input
            className="w-full border p-2 rounded"
            placeholder="email@iith.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button disabled={loading} className="w-full bg-black text-white py-3 rounded">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {selectedRole === "user" && (
          <p className="text-sm text-center mt-4 text-gray-600">
            New user? <Link to="/signup" className="text-blue-600">Create account</Link>
          </p>
        )}
      </div>
    </div>
  );
}
