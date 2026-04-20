import React, { useEffect, useState } from "react";
import DataTable from "../common/DataTable";
import Modal from "../common/Modal";
import { useAuth } from "../../contexts/AuthContext";
import apiClient from "../../services/api";

const Banks: React.FC = () => {
    const { user } = useAuth();

    const [banks, setBanks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const [formData, setFormData] = useState({
        bankName: "",
        bankAccoutntHolder: "",
        bankBranch: "",
        currency: "USD",
        bankAccount: "",
    });

    useEffect(() => {
        loadBanks();
    }, []);

    const loadBanks = async () => {
        try {
            setLoading(true);
            const res = await apiClient.getBanks();
            if (res.success) {
                setBanks(res.data || []);
            }
        } catch (err) {
            console.error("Bank Load Error:", err);
        } finally {
            setLoading(false);
        }
    };



    // 🔹 Create Bank
    const handleCreateBank = async () => {
        try {
            const res = await apiClient.bankstore(formData);

            if (res.success) {
                setShowCreateModal(false);
                setFormData({
                    bankName: "",
                    bankAccoutntHolder: "",
                    bankBranch: "",
                    currency: "USD",
                    bankAccount: "",
                });
                loadBanks();
            }
        } catch (err) {
            console.error("Create Error:", err);
        }
    };

    // 🔹 Table Columns
    const columns = [
        {
            key: "bankName",
            label: "Bank Name",
        },



        {
            key: "bankBranch",
            label: "Branch",
        },
        {
            key: "bankAccoutntHolder",
            label: "Account Holder",
        },

        {
            key: "currency",
            label: "Currency",
        },

        {
            key: "balance",
            label: "Balance",
            render: (value: any) => (
                <span>{Number(value || 0).toFixed(2)}</span>
            ),
        },
        {
            key: "bankAccount",
            label: "Account No",
        },
        {
            key: "created_at",
            label: "Date",
            render: (v: string) =>
                new Date(v).toLocaleDateString(),
        },
    ];

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold dark:text-white">
                    Bank Management
                </h1>

                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                    Create Bank
                </button>
            </div>

            {/* Table */}
            <DataTable
                data={banks}
                columns={columns}
                loading={loading}
                searchPlaceholder="Search banks..."
            />

            {/* Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Create Bank"
                size="md"
            >
                <div className="space-y-3">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                            Bank Name
                        </label>
                        <input name="bank Name" placeholder="Bank Name"
                            value={formData.bankName}
                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />


                    </div>


                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                            Currency
                        </label>

                        <select
                            value={formData.currency}
                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="USD">USD</option>
                            <option value="BDT">BDT</option>
                            <option value="INR">INR</option>
                        </select>


                    </div>


                    <div className="">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                            Bank Branch
                        </label>

                        <input placeholder="Bank Branch"
                            value={formData.bankBranch}
                            onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>


                    <div className="">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                            Account Holder
                        </label>
                        <input placeholder="Account Holder"
                            value={formData.bankAccoutntHolder}
                            onChange={(e) => setFormData({ ...formData, bankAccoutntHolder: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>



                    <div className="">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                            Account Number
                        </label>

                        <input placeholder="Account Number"
                            value={formData.bankAccount}
                            type='number'

                            onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                    </div>



                    <div className="flex justify-end">
                        <button
                            onClick={handleCreateBank}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg"
                        >
                            Submit
                        </button>
                    </div>

                </div>
            </Modal>
        </div>
    );
};

export default Banks;



    // public function walletToBank(Request $request)
    // {
    //     $user = auth()->user();

    //     $wallet = Wallet::where('id', $request->wallet_id)
    //         ->where('user_id', $user->user_id)
    //         ->first();

    //     $bank = Bank::where('id', $request->bank_id)
    //         ->where('user_id', $user->id)
    //         ->first();

    //     if (!$wallet || !$bank) {
    //         return response()->json(['message' => 'Invalid data'], 403);
    //     }

    //     if ($wallet->balance < $request->amount) {
    //         return response()->json(['message' => 'Insufficient balance'], 400);
    //     }

    //     $convertedAmount = $this->convert(
    //         $request->amount,
    //         $wallet->currency,
    //         $bank->currency
    //     );

    //     $wallet->decrement('balance', $request->amount);
    //     $bank->increment('balance', round($convertedAmount, 2));

    //     Transfer::create([
    //         'sender_id' => $user->id,
    //         'receiver_id' => $user->id,
    //         'currency' => $wallet->currency,
    //         'amount' => $request->amount,
    //         'fee' => 0,
    //         'type' => 'wallet_to_bank',
    //     ]);

    //     return response()->json([
    //         'success' => true,
    //         'converted_amount' => round($convertedAmount, 2)
    //     ]);
    // }
