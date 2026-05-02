import React, { useEffect, useState } from "react";
import DataTable from "../common/DataTable";
import Modal from "../common/Modal";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";
import apiClient from "../../services/api";




const TransferPage: React.FC = () => {
    const { user } = useAuth();

    const [transfers, setTransfers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [wallets, setWallets] = useState<any[]>([]);
    const [banks, setBanks] = useState<any[]>([]);

    const [showTransferModal, setShowTransferModal] = useState(false);

    const [transferType, setTransferType] = useState("wallet_to_wallet");

    const [formData, setFormData] = useState({
        email: "",
        amount: "",
        currency: "USD",
    });

    const [transferData, setTransferData] = useState<any>({
        amount: "",
        currency: "",
        bank_id: "",
        from_bank_id: "",
        to_bank_id: "",
        from_wallet_id: "",
        to_wallet_id: "",
    });

    const [selectedWalletId, setSelectedWalletId] = useState("");

    useEffect(() => {
        loadTransfers();
        loadBanks();
        loadWallets();
    }, []);

    const loadTransfers = async () => {
        try {
            setLoading(true);
            const response = await apiClient.getTransfers();

            if (response.success) {
                setTransfers(response.data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadBanks = async () => {
        try {
            const res = await apiClient.getBanks();

            if (res.success) setBanks(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setBanks([]);
        }
    };

    const loadWallets = async () => {
        try {
            const res = await apiClient.getWallets();
            // console.log(res);
            if (res.success) setWallets(Array.isArray(res.data.wallets) ? res.data.wallets : []);
        } catch (err) {
            console.error(err);
            setWallets([]);
        }
    };

    const handleTransfer = async () => {

        try {
            let res;
            if (transferType === "wallet_to_wallet") {

                if (!formData.email || !formData.amount) {
                    toast.error("Fill in all fields!");
                    return;
                }
                res = await apiClient.createTransfer({
                    email: formData.email,
                    amount: Number(formData.amount),
                    currency: formData.currency,
                });
            }




            if (transferType === "wallet_to_bank") {

                if (!selectedWalletId || !transferData.bank_id || !transferData.amount) {
                    toast.error("Select wallet, bank and enter amount!");
                    return;
                }

                res = await apiClient.walletToBank({
                    wallet_id: selectedWalletId,
                    bank_id: transferData.bank_id,
                    amount: Number(transferData.amount),
                    currency: transferData.currency,
                });
            }



            if (transferType === "bank_to_bank") {
                if (!transferData.from_bank_id || !transferData.to_bank_id || !transferData.amount) {
                    toast.error("Select both banks and enter amount!");
                    return;
                }
                res = await apiClient.bankToBank({
                    from_bank_id: transferData.from_bank_id,
                    to_bank_id: transferData.to_bank_id,
                    amount: Number(transferData.amount),
                    currency: transferData.currency,
                });
                console.log('bank_to_bank');

            }

            if (transferType === "wallet_to_walletToMySelf") {
                if (!transferData.from_wallet_id || !transferData.to_wallet_id || !transferData.amount) {
                    toast.error("Select both wallets and enter amount!");
                    return;
                }
                res = await apiClient.walletToMySelf({
                    from_wallet_id: transferData.from_wallet_id,
                    to_wallet_id: transferData.to_wallet_id,
                    amount: Number(transferData.amount),
                    currency: transferData.currency,
                });
            }

            if (res?.success) {
                toast.success("Transfer successful!");
                setShowTransferModal(false);
                await loadTransfers();
                setFormData({ email: "", amount: "", currency: "" });
                setTransferData({
                    amount: "",
                    currency: "",
                    bank_id: "",
                    from_bank_id: "",
                    to_bank_id: "",
                    from_wallet_id: "",
                    to_wallet_id: "",
                });
                // setSelectedWalletId("");
            }
        } catch (err) {
            console.error(err);
            toast.error("Transfer failed!");
        }
    };

    const transferColumns = [
        {
            key: "sender",
            label: "Sender",
            render: (_: any, row: any) => (
                <div>
                    <div>{row.sender?.name}</div>
                    <div className="text-xs">{row.sender?.email}</div>
                </div>
            ),
        },
        {
            key: "receiver",
            label: "Receiver",
            render: (_: any, row: any) => (
                <div>
                    <div>{row.receiver?.name}</div>
                    <div className="text-xs">{row.receiver?.email}</div>
                </div>
            ),
        },
        {
            key: "amount",
            label: "Amount",
            render: (value: any, row: any) => (
                <span>
                    {Number(value || 0).toFixed(2)} {row.currency}
                </span>
            ),
        },
        {
            key: "created_at",
            label: "Date",
            render: (value: string) => new Date(value).toLocaleDateString(),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Transfer Management</h1>
                <button
                    onClick={() => setShowTransferModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                    New Transfer
                </button>
            </div>

            <DataTable
                data={transfers}
                columns={transferColumns}
                loading={loading} />

            <Modal isOpen={showTransferModal} onClose={() => setShowTransferModal(false)} title="Transfer">
                <div className="space-y-3">
                    {/* TRANSFER TYPE */}


                    <div className="py-2">
                        <div className="flex flex-row flex-wrap gap-6">
                            {[
                                { id: 'wallet_to_wallet', label: 'Wallet → Wallet' },
                                { id: 'wallet_to_bank', label: 'Wallet → Bank' },
                                { id: 'bank_to_bank', label: 'Bank → Bank' },
                                { id: 'wallet_to_walletToMySelf', label: 'Wallet → Myself' },
                            ].map((option) => (
                                <label
                                    key={option.id}
                                    className="flex items-center space-x-2 cursor-pointer white"
                                >
                                    <input
                                        type="radio"
                                        name="transferType"
                                        value={option.id}
                                        checked={transferType === option.id}
                                        onChange={(e) => setTransferType(e.target.value)}
                                        className="w-4 h-4 text-blue-600 border-white-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-white-700"
                                    />

                                    {/* Text Label */}
                                    <span className={`text-sm font-medium 
                                     ${transferType === option.id
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-900'
                                        }`}
                                    >
                                        {option.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* WALLET → WALLET */}
                    {transferType === "wallet_to_wallet" && (
                        <>
                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    Receiver Email
                                </label>
                                <input
                                    type="email"
                                    placeholder="Receiver Email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>


                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    Amount
                                </label>
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>


                            <div className="">

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

                        </>
                    )}

                    {/* WALLET → BANK */}
                    {transferType === "wallet_to_bank" && (
                        <>
                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    Select Wallet
                                </label>
                                <select
                                    value={selectedWalletId}
                                    onChange={(e) => setSelectedWalletId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select Wallet</option>
                                    {Array.isArray(wallets) &&
                                        wallets.map((w) => (
                                            <option key={w.id} value={w.id}>
                                                {w.name} (Available: {w.available_balance.toFixed(2)} {w.currency})
                                            </option>
                                        ))}
                                </select>
                            </div>


                            {/* {selectedWalletId && (
                                <div className="text-sm text-gray-500 mt-1">
                                    Available Balance:{" "}
                                    {wallets.find((w) => w.id === selectedWalletId)?.available_balance.toFixed(2)}{" "}
                                    {wallets.find((w) => w.id === selectedWalletId)?.currency}
                                </div>
                            )} */}


                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    Select Bank
                                </label>
                                <select
                                    value={transferData.bank_id}
                                    onChange={(e) => setTransferData({ ...transferData, bank_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select Bank</option>
                                    {Array.isArray(banks) &&
                                        banks.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                ({b.bankAccount} - {b.currency})

                                            </option>
                                        ))}
                                </select>
                            </div>



                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    Amount
                                </label>
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={transferData.amount}
                                    onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                        </>
                    )}

                    {/* BANK → BANK */}
                    {transferType === "bank_to_bank" && (
                        <>
                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    From Bank
                                </label>
                                <select
                                    value={transferData.from_bank_id}
                                    onChange={(e) => setTransferData({ ...transferData, from_bank_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">From Bank</option>
                                    {Array.isArray(banks) &&
                                        banks.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.bankAccount}-{b.currency}
                                            </option>

                                        ))}
                                </select>
                            </div>



                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    To Bank
                                </label>
                                <select
                                    value={transferData.to_bank_id}
                                    onChange={(e) => setTransferData({ ...transferData, to_bank_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">To Bank</option>
                                    {Array.isArray(banks) &&
                                        banks.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.bankAccount}-{b.currency}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    Amount
                                </label>
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={transferData.amount}
                                    onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>


                        </>
                    )}

                    {/* WALLET → WALLET TO MYSELF */}
                    {transferType === "wallet_to_walletToMySelf" && (
                        <>
                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    From Wallet
                                </label>
                                <select
                                    value={transferData.from_wallet_id}
                                    onChange={(e) => setTransferData({ ...transferData, from_wallet_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">From Wallet</option>
                                    {Array.isArray(wallets) &&
                                        wallets.map((w) => (
                                            <option key={w.id} value={w.id}>
                                                {w.name} (Available: {w.available_balance.toFixed(2)} {w.currency})
                                            </option>
                                        ))}
                                </select>
                            </div>


                            {/* {transferData.from_wallet_id && (
                                <div className="text-sm text-gray-500 mt-1">
                                    Available Balance:{" "}
                                    {wallets.find((w) => w.id === transferData.from_wallet_id)?.available_balance.toFixed(2)}{" "}
                                    {wallets.find((w) => w.id === transferData.from_wallet_id)?.currency}
                                </div>
                            )} */}

                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    To Wallet
                                </label>
                                <select
                                    value={transferData.to_wallet_id}
                                    onChange={(e) => setTransferData({ ...transferData, to_wallet_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">To Wallet</option>
                                    {Array.isArray(wallets) &&
                                        wallets.map((w) => (
                                            <option key={w.id} value={w.id}>
                                                {w.name} (Available: {w.available_balance.toFixed(2)} {w.currency})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="">
                                    Amount
                                </label>
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={transferData.amount}
                                    onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>


                        </>
                    )}

                    <button
                        onClick={handleTransfer}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg w-full"
                    >
                        Submit
                    </button>
                </div>
            </Modal>

        </div>
    );
};

export default TransferPage;
