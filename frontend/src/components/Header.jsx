import { LogOut, Lock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Reusable Header Component with two design variants
 * variant: "minimalist" | "modern"
 * Set variant in the component usage to switch styles
 */
export default function Header({ variant = "modern" }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (variant === "minimalist") {
    return (
      <header className="bg-white border-b-2 border-orange-300 sticky top-0 z-10">
        <div className="px-6 h-16 flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 p-2 rounded-lg">
              <img src="/iith-logo.png" alt="IITH" className="h-8 object-contain" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">IIT Hyderabad</h1>
              <p className="text-xs text-orange-600 font-medium">Payment Gateway</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Link
              to="/change-password"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:text-orange-600 hover:bg-orange-50 transition-all duration-200"
              title="Change Password"
            >
              <Lock size={18} />
              <span className="text-sm font-medium hidden sm:inline">Change Password</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:text-orange-600 hover:bg-orange-50 transition-all duration-200 font-medium text-sm cursor-pointer"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Modern variant with gradients and shadows
  return (
    <header className="sticky top-0 z-10 shadow-md">
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-orange-400">
        <div className="px-6 h-16 flex items-center justify-between bg-white/95 backdrop-blur-sm border-b border-orange-200">
          {/* Logo Section */}
          <div className="flex items-center gap-3 group">
            <div className="bg-gradient-to-br from-orange-100 to-orange-200 p-2.5 rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300">
              <img src="/iith-logo.png" alt="IITH" className="h-8 object-contain filter" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Indian Institute of Technology Hyderabad</h1>
              <p className="text-xs bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent font-semibold">Payment Gateway</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <Link
              to="/change-password"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-gray-700 hover:text-white bg-gray-100 hover:bg-gradient-to-r hover:from-orange-400 hover:to-orange-500 transition-all duration-200 font-medium text-sm group/btn"
              title="Change Password"
            >
              <Lock size={18} className="group-hover/btn:scale-110 transition-transform" />
              <span className="hidden sm:inline">Change Password</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-400 hover:to-orange-600 shadow-md hover:shadow-lg transition-all duration-200 font-medium text-sm cursor-pointer group/btn"
            >
              <LogOut size={18} className="group-hover/btn:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
