import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Admin from "./pages/admin/Admin";
import AddMerchant from "./pages/admin/AddMerchant";
import User from "./pages/user/User";
import Merchant from "./pages/merchant/Merchant";
import ChangePassword from "./pages/ChangePassword";
import SystemAdmin from "./pages/systemAdmin/SystemAdmin";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicOnlyRoute from "./components/PublicOnlyRoute";

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <Signup />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/system-admin"
        element={
          <ProtectedRoute allowedRoles={["system_admin"]}>
            <SystemAdmin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin", "system_admin"]}>
            <Admin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/addMerchant"
        element={
          <ProtectedRoute allowedRoles={["admin", "system_admin"]}>
            <AddMerchant />
          </ProtectedRoute>
        }
      />

      <Route
        path="/user"
        element={
          <ProtectedRoute allowedRoles={["user"]}>
            <User />
          </ProtectedRoute>
        }
      />

      <Route
        path="/merchant"
        element={
          <ProtectedRoute allowedRoles={["merchant"]}>
            <Merchant />
          </ProtectedRoute>
        }
      />

      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
