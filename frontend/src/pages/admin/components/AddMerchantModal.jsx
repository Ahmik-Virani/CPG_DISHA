import { X, User, Mail, Lock } from "lucide-react";

export default function AddMerchantModal({
  isOpen,
  merchantName,
  merchantEmail,
  merchantPassword,
  merchantError,
  isSubmitting,
  onClose,
  onSubmit,
  onMerchantNameChange,
  onMerchantEmailChange,
  onMerchantPasswordChange,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-t-2xl">
          <h3 className="text-lg font-semibold">Onboard Merchant</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/20 transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Merchant Name</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                className="w-full border border-gray-300 pl-10 pr-3 py-3 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors"
                placeholder="Enter merchant name"
                value={merchantName}
                onChange={(e) => onMerchantNameChange(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                className="w-full border border-gray-300 pl-10 pr-3 py-3 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors"
                placeholder="merchant@iith.ac.in"
                value={merchantEmail}
                onChange={(e) => onMerchantEmailChange(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Temporary Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                className="w-full border border-gray-300 pl-10 pr-3 py-3 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors"
                placeholder="Minimum 8 characters"
                value={merchantPassword}
                onChange={(e) => onMerchantPasswordChange(e.target.value)}
              />
            </div>
          </div>

          {merchantError ? <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{merchantError}</p> : null}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-6 py-2 rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              {isSubmitting ? "Adding..." : "Add Merchant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
