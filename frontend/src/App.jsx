import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Admin from "./pages/admin/Admin";
import AddMerchant from "./pages/admin/AddMerchant";
import User from "./pages/user/User";
import Merchant from "./pages/merchant/Merchant";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/user" element={<User />} />
      <Route path="/merchant" element={<Merchant />} />
      <Route path="/admin/addMerchant" element={<AddMerchant />} />
    </Routes>
  );
}

export default App;