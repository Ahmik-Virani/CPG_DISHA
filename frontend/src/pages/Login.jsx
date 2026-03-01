import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Shield, Building } from "lucide-react";

export default function Login() {
  const [role, setRole] = useState("admin");
  const navigate = useNavigate();

  const login = () => {
    navigate("/" + role);
  };

  return (
    <div className="min-h-screen bg-sky-100 flex items-center justify-center">
      <div className="bg-white w-[420px] p-8 rounded-2xl shadow">

        {/* Top Icon */}
        <div className="flex justify-center mb-4">
          <div className="bg-indigo-500 text-white p-3 rounded-full">
            <Shield size={24} />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-center">
          IIT Payment Gateway
        </h1>

        <p className="text-center text-gray-500 mb-6">
          Sign in to your account
        </p>

        {/* Role Switch */}
        <div className="flex bg-gray-100 rounded-full p-1 mb-6">

          <button
            className={`flex-1 py-2 rounded-full flex items-center justify-center gap-2 ${
              role === "user" && "bg-white"
            }`}
            onClick={() => setRole("user")}
          >
            <User size={16} />
            User
          </button>

          <button
            className={`flex-1 py-2 rounded-full flex items-center justify-center gap-2 ${
              role === "merchant" && "bg-white"
            }`}
            onClick={() => setRole("merchant")}
          >
            <Building size={16} />
            Merchant
          </button>

          <button
            className={`flex-1 py-2 rounded-full flex items-center justify-center gap-2 ${
              role === "admin" && "bg-white"
            }`}
            onClick={() => setRole("admin")}
          >
            <Shield size={16} />
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

