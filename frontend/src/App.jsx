import { Routes, Route } from "react-router-dom";
import Login from "./Login";
import Admin from "./pages/Admin";
import User from "./pages/User";
import Merchant from "./pages/Merchant";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/user" element={<User />} />
      <Route path="/merchant" element={<Merchant />} />
    </Routes>
  );
}

export default App;