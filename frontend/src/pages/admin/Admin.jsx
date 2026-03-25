import {
  Store,
  LogOut,
  ShieldAlert,
  Building2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { adminApi } from "../../lib/api";
import SystemHeadPage from "./components/SystemHeadPage";
import BankPage from "./components/BankPage";
import FraudRulePage from "./components/FraudRulePage";
import AddMerchantModal from "./components/AddMerchantModal";
import BankModal from "./components/BankModal";

function createBankPair(id, key = "", value = "") {
  return { id, key, value };
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("system_head");
  const [systemHeads, setSystemHeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddMerchantOpen, setIsAddMerchantOpen] = useState(false);
  const [merchantName, setMerchantName] = useState("");
  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantPassword, setMerchantPassword] = useState("");
  const [merchantError, setMerchantError] = useState("");
  const [isSubmittingMerchant, setIsSubmittingMerchant] = useState(false);
  const [banks, setBanks] = useState([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [bankError, setBankError] = useState("");
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [editingBankId, setEditingBankId] = useState("");
  const [bankPairs, setBankPairs] = useState([createBankPair(1, "name", "")]);
  const [nextBankPairId, setNextBankPairId] = useState(2);
  const [isSubmittingBank, setIsSubmittingBank] = useState(false);
  const [isDeletingBank, setIsDeletingBank] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAdminData() {
      if (!token) {
        if (isMounted) {
          setSystemHeads([]);
          setIsLoading(false);
          setBanks([]);
          setIsLoadingBanks(false);
        }
        return;
      }

      try {
        const [headsData, banksData] = await Promise.all([
          adminApi.listSystemHeads(token),
          adminApi.listBanks(token),
        ]);
        if (isMounted) {
          setSystemHeads(Array.isArray(headsData.users) ? headsData.users : []);
          setBanks(Array.isArray(banksData.banks) ? banksData.banks : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load system heads");
          setBankError(err.message || "Failed to load banks");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsLoadingBanks(false);
        }
      }
    }

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const filteredHeads = useMemo(() => {
    if (!searchQuery.trim()) return systemHeads;
    const q = searchQuery.trim().toLowerCase();
    return systemHeads.filter(
      (sh) =>
        sh.name?.toLowerCase().includes(q) ||
        sh.email?.toLowerCase().includes(q)
    );
  }, [systemHeads, searchQuery]);

  const normalizedBankPairs = useMemo(
    () =>
      bankPairs
        .map((pair) => ({
          key: pair.key.trim(),
          value: pair.value.trim(),
        }))
        .filter((pair) => pair.key && pair.value),
    [bankPairs]
  );

  const resetMerchantForm = () => {
    setMerchantName("");
    setMerchantEmail("");
    setMerchantPassword("");
    setMerchantError("");
  };

  const handleAddMerchant = async (e) => {
    e.preventDefault();
    setMerchantError("");

    if (!merchantName.trim() || !merchantEmail.trim() || !merchantPassword) {
      setMerchantError("Name, email, and password are required");
      return;
    }

    if (merchantPassword.length < 8) {
      setMerchantError("Password must be at least 8 characters");
      return;
    }

    try {
      setIsSubmittingMerchant(true);
      await adminApi.createMerchant(token, {
        name: merchantName.trim(),
        email: merchantEmail.trim(),
        password: merchantPassword,
      });

      const data = await adminApi.listSystemHeads(token);
      setSystemHeads(Array.isArray(data.users) ? data.users : []);
      setIsAddMerchantOpen(false);
      resetMerchantForm();
    } catch (err) {
      setMerchantError(err.message || "Failed to add merchant");
    } finally {
      setIsSubmittingMerchant(false);
    }
  };

  const resetBankForm = () => {
    setBankPairs([createBankPair(1, "name", "")]);
    setNextBankPairId(2);
    setBankError("");
    setEditingBankId("");
    setIsEditingBank(false);
  };

  const handleOpenAddBank = () => {
    resetBankForm();
    setIsBankModalOpen(true);
  };

  const handleOpenEditBank = (bank) => {
    const fields = Array.isArray(bank?.fields) ? bank.fields : [];
    const hasName = fields.some((field) => String(field?.key || "").trim().toLowerCase() === "name");
    const rows = fields.length
      ? fields.map((field, index) => createBankPair(index + 1, field.key || "", field.value || ""))
      : [];

    if (!hasName) {
      rows.unshift(createBankPair(rows.length + 1, "name", ""));
    }

    setBankPairs(rows);
    setNextBankPairId(rows.length + 1);
    setEditingBankId(bank.id);
    setIsEditingBank(true);
    setBankError("");
    setIsBankModalOpen(true);
  };

  const handleAddBankPair = () => {
    setBankPairs((prev) => [...prev, createBankPair(nextBankPairId)]);
    setNextBankPairId((prev) => prev + 1);
  };

  const handleRemoveBankPair = (pairId) => {
    setBankPairs((prev) => {
      const pairToDelete = prev.find((pair) => pair.id === pairId);
      if (isNamePair(pairToDelete) || prev.length <= 1) {
        return prev;
      }

      return prev.filter((pair) => pair.id !== pairId);
    });
  };

  const handleUpdateBankPair = (pairId, field, value) => {
    setBankPairs((prev) =>
      prev.map((pair) => (pair.id === pairId ? { ...pair, [field]: value } : pair))
    );
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    setBankError("");

    if (!normalizedBankPairs.length) {
      setBankError("Add at least one key-value pair");
      return;
    }

    const uniqueKeys = new Set(normalizedBankPairs.map((pair) => pair.key.toLowerCase()));
    if (uniqueKeys.size !== normalizedBankPairs.length) {
      setBankError("Each key should be unique");
      return;
    }

    const nameField = normalizedBankPairs.find((pair) => pair.key.toLowerCase() === "name");
    if (!nameField || !nameField.value) {
      setBankError("name field is mandatory");
      return;
    }

    try {
      setIsSubmittingBank(true);

      if (isEditingBank && editingBankId) {
        const data = await adminApi.updateBank(token, editingBankId, {
          fields: normalizedBankPairs,
        });
        setBanks((prev) => prev.map((bank) => (bank.id === editingBankId ? data.bank : bank)));
      } else {
        const data = await adminApi.createBank(token, {
          fields: normalizedBankPairs,
        });
        setBanks((prev) => [data.bank, ...prev]);
      }

      setIsBankModalOpen(false);
      resetBankForm();
    } catch (err) {
      setBankError(err.message || "Failed to save bank");
    } finally {
      setIsSubmittingBank(false);
    }
  };

  const handleDeleteBank = async () => {
    if (!editingBankId) {
      return;
    }

    const confirmed = window.confirm("Delete this bank?");
    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingBank(true);
      await adminApi.deleteBank(token, editingBankId);
      setBanks((prev) => prev.filter((bank) => bank.id !== editingBankId));
      setIsBankModalOpen(false);
      resetBankForm();
    } catch (err) {
      setBankError(err.message || "Failed to delete bank");
    } finally {
      setIsDeletingBank(false);
    }
  };

  const handleToggleBankStatus = async (bank) => {
    const nextEnabled = bank.enabled === false;

    try {
      const data = await adminApi.toggleBankStatus(token, bank.id, nextEnabled);
      setBanks((prev) => prev.map((item) => (item.id === bank.id ? data.bank : item)));
    } catch (err) {
      setBankError(err.message || "Failed to update bank status");
    }
  };

  return (
    <div className="min-h-screen bg-sky-50">
      <div className="flex justify-between items-center px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            <Store size={20} />
          </div>
          <div>
            <h1 className="font-semibold text-lg">IIT Hyderabad Payment Gateway</h1>
            <p className="text-sm text-gray-500">{user?.role} panel</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/change-password" className="border px-4 py-2 rounded-lg">Change Password</Link>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="border px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      <div className="bg-sky-50 px-6 py-4">
        <div className="inline-flex bg-gray-200 p-1 rounded-full gap-1">
          <button
            onClick={() => setActiveTab("system_head")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "system_head" ? "bg-white shadow text-black" : "text-gray-600 hover:text-black"
            }`}
          >
            <Store size={16} /> System Head
          </button>

          <button
            onClick={() => setActiveTab("banks")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "banks" ? "bg-white shadow text-black" : "text-gray-600 hover:text-black"
            }`}
          >
            <Building2 size={16} /> Manage Banks
          </button>

          <button
            onClick={() => setActiveTab("fraud")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "fraud" ? "bg-white shadow text-black" : "text-gray-600 hover:text-black"
            }`}
          >
            <ShieldAlert size={16} /> Fraud Detection
          </button>

          
        </div>
      </div>

      <div className="p-8">
        {activeTab === "system_head" && (
          <SystemHeadPage
            filteredHeads={filteredHeads}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            error={error}
            isLoading={isLoading}
            onOpenAddMerchant={() => setIsAddMerchantOpen(true)}
          />
        )}

        {activeTab === "fraud" && <FraudRulePage />}

        {activeTab === "banks" && (
          <BankPage
            banks={banks}
            isLoading={isLoadingBanks}
            error={bankError}
            onOpenAddBank={handleOpenAddBank}
            onOpenEditBank={handleOpenEditBank}
            onToggleBankStatus={handleToggleBankStatus}
          />
        )}
      </div>

      <AddMerchantModal
        isOpen={isAddMerchantOpen}
        merchantName={merchantName}
        merchantEmail={merchantEmail}
        merchantPassword={merchantPassword}
        merchantError={merchantError}
        isSubmitting={isSubmittingMerchant}
        onClose={() => {
          setIsAddMerchantOpen(false);
          resetMerchantForm();
        }}
        onSubmit={handleAddMerchant}
        onMerchantNameChange={setMerchantName}
        onMerchantEmailChange={setMerchantEmail}
        onMerchantPasswordChange={setMerchantPassword}
      />

      <BankModal
        isOpen={isBankModalOpen}
        isEditing={isEditingBank}
        bankPairs={bankPairs}
        bankError={bankError}
        isSubmitting={isSubmittingBank}
        isDeleting={isDeletingBank}
        onClose={() => {
          setIsBankModalOpen(false);
          resetBankForm();
        }}
        onSubmit={handleSaveBank}
        onAddPair={handleAddBankPair}
        onUpdatePair={handleUpdateBankPair}
        onRemovePair={handleRemoveBankPair}
        onDelete={handleDeleteBank}
      />
    </div>
  );
}
