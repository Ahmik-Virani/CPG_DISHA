import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Settings, User } from "lucide-react";
import { getRoleHomePath } from "../../auth/roleHome";

export default function Signup() {
  const navigate = useNavigate();
  const { signup, loading } = useAuth();

  const [name, setName] = useState("");
  const [roll_no, setRollNo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState("user");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const user = await signup(name, roll_no, email, password, selectedRole);
      navigate(getRoleHomePath(user.role));
    } catch (err) {
      setError(err.message || "Signup failed");
    }
  };

  return (
    <div className="min-h-screen bg-sky-100 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow">
        <h1 className="text-2xl font-semibold text-center mb-2">Create Account</h1>
        <p className="text-center text-gray-500 mb-6">
          Self-signup is available for users and system heads
        </p>

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
              onClick={() => { setSelectedRole("system_head"); setRollNo(""); }}
            >
              <Settings size={16} /> System Head
            </button>
          </div>

          <input
            className="w-full border p-2 rounded"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {selectedRole === "user" && (
            <input
              className="w-full border p-2 rounded"
              placeholder="Roll Number"
              value={roll_no}
              onChange={(e) => setRollNo(e.target.value.toUpperCase())}
            />
          )}
          <input
            className="w-full border p-2 rounded"
            placeholder="email@iith.ac.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button disabled={loading} className="w-full bg-black text-white py-3 rounded">
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-center mt-4 text-gray-600">
          Already have an account? <Link to="/" className="text-blue-600">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
