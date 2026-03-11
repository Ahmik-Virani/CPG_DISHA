import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getRoleHomePath } from "../../auth/roleHome";

export default function ChangePassword() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setStatus("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Failed to change password");
    }
  };

  return (
    <div className="min-h-screen bg-sky-100 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow">
        <h1 className="text-2xl font-semibold mb-2">Change Password</h1>
        <p className="text-gray-500 mb-6">Logged in as {user?.email}</p>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {status ? <p className="text-sm text-green-700">{status}</p> : null}

          <button className="w-full bg-black text-white py-3 rounded">Update Password</button>
        </form>

        <div className="mt-4 text-sm">
          <Link to={getRoleHomePath(user?.role)} className="text-blue-600">Back to dashboard</Link>
          <button className="ml-4 text-blue-600" onClick={() => navigate(-1)}>
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
