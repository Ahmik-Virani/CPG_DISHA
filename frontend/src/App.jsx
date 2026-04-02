import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/login/Login";
import Signup from "./pages/login/Signup";
import Admin from "./pages/admin/Admin";
import SystemHeadPaymentHistory from "./pages/admin/components/SystemHeadPaymentHistory";
import User from "./pages/user/User";
import PaymentDetails from "./pages/user/PaymentDetails";
import SystemHead from "./pages/system_head/System_Head";
import ManageEvent from "./pages/system_head/ManageEvent";
import EventPage from "./pages/system_head/EventPage";
import ChangePassword from "./pages/login/ChangePassword";
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
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Admin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/system-head/:systemHeadId/payment-history"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <SystemHeadPaymentHistory />
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
        path="/user/payment/:paymentId"
        element={
          <ProtectedRoute allowedRoles={["user"]}>
            <PaymentDetails />
          </ProtectedRoute>
        }
      />

      <Route
        path="/system_head"
        element={
          <ProtectedRoute allowedRoles={["system_head"]}>
            <SystemHead />
          </ProtectedRoute>
        }
      />

      <Route
        path="/system_head/manage-event"
        element={
          <ProtectedRoute allowedRoles={["system_head"]}>
            <ManageEvent />
          </ProtectedRoute>
        }
      />

      <Route
        path="/system_head/manage-event/:eventId"
        element={
          <ProtectedRoute allowedRoles={["system_head"]}>
            <EventPage />
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
