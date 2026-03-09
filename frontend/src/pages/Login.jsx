import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building, Shield, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getRoleHomePath } from "../auth/roleHome";

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("any");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const user = await login(email, password);

      if (selectedRole !== "any" && user.role !== selectedRole) {
        logout();
        setError(`This account is a ${user.role}. Please choose the correct role.`);
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
          <div className="grid grid-cols-2 gap-2 bg-gray-100 rounded-xl p-2">
            <button
              type="button"
              className={`py-2 rounded-lg text-sm flex items-center justify-center gap-2 ${
                selectedRole === "system_admin" ? "bg-white" : ""
              }`}
              onClick={() => setSelectedRole("system_admin")}
            >
              <Shield size={15} /> System Admin
            </button>
            <button
              type="button"
              className={`py-2 rounded-lg text-sm flex items-center justify-center gap-2 ${
                selectedRole === "admin" ? "bg-white" : ""
              }`}
              onClick={() => setSelectedRole("admin")}
            >
              <Shield size={15} /> Admin
            </button>
            <button
              type="button"
              className={`py-2 rounded-lg text-sm flex items-center justify-center gap-2 ${
                selectedRole === "merchant" ? "bg-white" : ""
              }`}
              onClick={() => setSelectedRole("merchant")}
            >
              <Building size={15} /> Merchant
            </button>
            <button
              type="button"
              className={`py-2 rounded-lg text-sm flex items-center justify-center gap-2 ${
                selectedRole === "user" ? "bg-white" : ""
              }`}
              onClick={() => setSelectedRole("user")}
            >
              <User size={15} /> User
            </button>
          </div>

          <button
            type="button"
            className={`w-full border py-2 rounded-lg text-sm ${selectedRole === "any" ? "bg-gray-100" : ""}`}
            onClick={() => setSelectedRole("any")}
          >
            Role: Any (auto-detect)
          </button>

          <input
            className="w-full border p-2 rounded"
            placeholder="email@iith.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button disabled={loading} className="w-full bg-black text-white py-3 rounded">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-center mt-4 text-gray-600">
          New user? <Link to="/signup" className="text-blue-600">Create account</Link>
        </p>
      </div>
    </div>
  );
}
