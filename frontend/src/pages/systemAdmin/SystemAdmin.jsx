import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function SystemAdmin() {
  const { user, createUser, logout } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    try {
      const data = await createUser({
        name,
        email,
        role,
        password,
      });
      setResult(data);
      setName("");
      setEmail("");
      setRole("admin");
      setPassword("");
    } catch (err) {
      setError(err.message || "Failed to create user");
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-semibold">System Admin Console</h1>
            <p className="text-gray-600">Logged in as {user?.email}</p>
          </div>
          <button onClick={logout} className="border px-3 py-2 rounded-lg">Logout</button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <h2 className="text-lg font-medium">Generate Login For New User</h2>

          <input
            className="w-full border rounded p-2"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full border rounded p-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <select className="w-full border rounded p-2" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="admin">Admin</option>
            <option value="merchant">Merchant</option>
            <option value="user">User</option>
          </select>

          <input
            className="w-full border rounded p-2"
            placeholder="Optional password (leave blank to auto-generate)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button className="bg-black text-white px-4 py-2 rounded-lg">Create Credentials</button>
        </form>

        {result ? (
          <div className="mt-6 border rounded-xl p-4 bg-slate-50">
            <p className="font-medium mb-1">Credentials generated</p>
            <p>Email: {result.user?.email}</p>
            <p>Role: {result.user?.role}</p>
            <p className="font-medium text-amber-700">Password: {result.generatedPassword}</p>
            <p className="text-xs text-gray-600 mt-2">Share this once. User will be asked to change password.</p>
          </div>
        ) : null}

        <div className="mt-6 text-sm flex gap-4">
          <Link to="/admin" className="text-blue-600">Go to Admin Dashboard</Link>
          <Link to="/change-password" className="text-blue-600">Change my password</Link>
        </div>
      </div>
    </div>
  );
}
