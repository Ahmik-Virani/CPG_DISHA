import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [role, setRole] = useState("admin");
  const navigate = useNavigate();

  const login = () => {
    navigate("/" + role);
  };

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center">
      <div className="bg-white w-[420px] p-8 rounded-2xl shadow">

        <h1 className="text-2xl font-semibold text-center">
          IIT Payment Gateway
        </h1>

        <p className="text-center text-gray-500 mb-6">
          Sign in to your account
        </p>

        <div className="flex bg-gray-100 rounded-full p-1 mb-6">

          <button
            className={`flex-1 py-2 rounded-full ${
              role === "user" && "bg-white"
            }`}
            onClick={() => setRole("user")}
          >
            User
          </button>

          <button
            className={`flex-1 py-2 rounded-full ${
              role === "merchant" && "bg-white"
            }`}
            onClick={() => setRole("merchant")}
          >
            Merchant
          </button>

          <button
            className={`flex-1 py-2 rounded-full ${
              role === "admin" && "bg-white"
            }`}
            onClick={() => setRole("admin")}
          >
            Admin
          </button>

        </div>

        <input
          className="w-full border p-2 rounded mb-3"
          placeholder={`${role}@iith.ac.in`}
        />

        <input
          type="password"
          className="w-full border p-2 rounded mb-5"
          placeholder="password"
        />

        <button
          onClick={login}
          className="w-full bg-black text-white py-3 rounded"
        >
          Sign In as {role}
        </button>

      </div>
    </div>
  );
}