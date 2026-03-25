import {
  Search,
  Store,
  LogOut,
  ShieldAlert,
  ArrowUpRight,
  Plus,
  X,
  Building2,
  Trash2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { adminApi } from "../../lib/api";

function createBankPair(id, key = "", value = "") {
  return { id, key, value };
}

function isNamePair(pair) {
  return String(pair?.key || "").trim().toLowerCase() === "name";
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
            onClick={() => setActiveTab("fraud")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "fraud" ? "bg-white shadow text-black" : "text-gray-600 hover:text-black"
            }`}
          >
            <ShieldAlert size={16} /> Fraud Detection
          </button>

          <button
            onClick={() => setActiveTab("banks")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-200 ${
              activeTab === "banks" ? "bg-white shadow text-black" : "text-gray-600 hover:text-black"
            }`}
          >
            <Building2 size={16} /> Manage Banks
          </button>
        </div>
      </div>

      <div className="p-8">
        {activeTab === "system_head" && (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold">Manage System Heads</h2>
              </div>

              <button
                onClick={() => setIsAddMerchantOpen(true)}
                className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} /> Add Merchant
              </button>
            </div>

            <div className="flex items-center bg-white border rounded-lg px-3 py-2 w-87.5 mb-8">
              <Search size={16} className="text-gray-500" />
              <input
                className="ml-2 outline-none w-full"
                placeholder="Search System Head..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

            {isLoading ? (
              <div className="text-center text-gray-500">Loading system heads...</div>
            ) : filteredHeads.length > 0 ? (
              <div className="grid grid-cols-3 gap-6">
                {filteredHeads.map((sh) => (
                  <div
                    key={sh.id}
                    className="group relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                  >
                    <div className="absolute top-6 right-6 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <ArrowUpRight size={18} className="text-gray-600" />
                    </div>

                    <h3 className="font-semibold text-lg mb-1">{sh.name}</h3>
                    <p className="text-gray-500 text-sm">{sh.email}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
                <p className="text-lg font-medium text-gray-700">
                  {searchQuery.trim() ? "No matching system heads" : "No system heads found"}
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "fraud" && <div className="text-center text-gray-500 text-xl mt-20">Coming Soon</div>}

        {activeTab === "banks" && (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold">Manage Banks</h2>
                <p className="text-sm text-gray-500">Create and maintain bank records used in payment requests.</p>
              </div>

              <button
                onClick={handleOpenAddBank}
                className="bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} /> Add Bank
              </button>
            </div>

            {bankError ? <p className="mb-4 text-sm text-red-600">{bankError}</p> : null}

            {isLoadingBanks ? (
              <div className="text-center text-gray-500">Loading banks...</div>
            ) : banks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {banks.map((bank) => (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => handleOpenEditBank(bank)}
                    className="group relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left"
                  >
                    <div className="absolute top-6 right-6 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <ArrowUpRight size={18} className="text-gray-600" />
                    </div>

                    <h3 className="font-semibold text-lg mb-2">{bank.displayName}</h3>
                    <p className="text-gray-500 text-sm mb-3">Fields: {bank.fields?.length || 0}</p>
                    <div className="space-y-1">
                      {(Array.isArray(bank.fields) ? bank.fields : []).slice(0, 3).map((field) => (
                        <p key={field.key} className="text-xs text-gray-600 truncate">
                          {field.key}: {field.value}
                        </p>
                      ))}
                      {(bank.fields?.length || 0) > 3 ? (
                        <p className="text-xs text-gray-500">+{bank.fields.length - 3} more</p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
                <p className="text-lg font-medium text-gray-700">No banks found</p>
                <p className="text-sm text-gray-500 mt-1">Add a bank to make it available in payment requests.</p>
              </div>
            )}
          </>
        )}
      </div>

      {isAddMerchantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Onboard Merchant</h3>
              <button
                onClick={() => {
                  setIsAddMerchantOpen(false);
                  resetMerchantForm();
                }}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddMerchant} className="p-6 space-y-3">
              <input
                className="w-full border p-2 rounded"
                placeholder="Merchant name"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
              />
              <input
                className="w-full border p-2 rounded"
                placeholder="merchant@iith.ac.in"
                value={merchantEmail}
                onChange={(e) => setMerchantEmail(e.target.value)}
              />
              <input
                type="password"
                className="w-full border p-2 rounded"
                placeholder="Temporary password (min 8 chars)"
                value={merchantPassword}
                onChange={(e) => setMerchantPassword(e.target.value)}
              />

              {merchantError ? <p className="text-sm text-red-600">{merchantError}</p> : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMerchantOpen(false);
                    resetMerchantForm();
                  }}
                  className="border px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMerchant}
                  className="bg-black text-white px-4 py-2 rounded-lg"
                >
                  {isSubmittingMerchant ? "Adding..." : "Add Merchant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">{isEditingBank ? "Edit Bank" : "Add Bank"}</h3>
              <button
                onClick={() => {
                  setIsBankModalOpen(false);
                  resetBankForm();
                }}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="p-6 space-y-4">
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {bankPairs.map((pair) => (
                  <div key={pair.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <input
                      className="w-full border p-2 rounded"
                      placeholder="Key (example: name)"
                      value={pair.key}
                      disabled={isNamePair(pair)}
                      onChange={(e) => handleUpdateBankPair(pair.id, "key", e.target.value)}
                    />
                    <input
                      className="w-full border p-2 rounded"
                      placeholder={isNamePair(pair) ? "Bank Name (example: ICICI)" : "Value (example: ICICI)"}
                      value={pair.value}
                      onChange={(e) => handleUpdateBankPair(pair.id, "value", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveBankPair(pair.id)}
                      disabled={isNamePair(pair)}
                      className="inline-flex items-center justify-center rounded-lg border px-3 py-2"
                      aria-label="Remove key value pair"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddBankPair}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <Plus size={14} className="inline mr-1" /> Add Key-Value Pair
              </button>

              {bankError ? <p className="text-sm text-red-600">{bankError}</p> : null}

              <div className="flex justify-between gap-2 pt-2">
                <div>
                  {isEditingBank ? (
                    <button
                      type="button"
                      onClick={handleDeleteBank}
                      disabled={isDeletingBank || isSubmittingBank}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
                    >
                      {isDeletingBank ? "Deleting..." : "Delete Bank"}
                    </button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBankModalOpen(false);
                      resetBankForm();
                    }}
                    className="border px-4 py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBank || isDeletingBank}
                    className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60"
                  >
                    {isSubmittingBank ? "Saving..." : isEditingBank ? "Save Changes" : "Add Bank"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
