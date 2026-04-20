import React, { useEffect, useState } from "react";
import { DollarSign, LocateIcon } from "lucide-react";
import DataTable from "../common/DataTable";
import Modal from "../common/Modal";
import { useAuth } from "../../contexts/AuthContext";
import apiClient from "../../services/api";

const Requests: React.FC = () => {
    const { user } = useAuth();

    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [wallets, setWallets] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    // const [isLoading, setIsLoading] = useState(false);
    // const [countdown, setCountdown] = useState(3);

    const [formData, setFormData] = useState({
        email: "",
        amount: "",
        currency: "USD",
    });
    useEffect(() => {
        loadRequests();

    },
        []);



    const loadRequests = async () => {
        try {
            setLoading(true);
            const response = await apiClient.getRequests();
            if (response.success) {
                setRequests(response.data || []);
            }
        } catch (error) {
            console.error("Request Load Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const acceptRequest = async (user_id: number) => {

        try {
            const res = await apiClient.acceptRequest(user_id);
            if (res.success) {
                loadRequests();
            }
        } catch (err) {
            console.error("Accept error", err);
        }
        console.log(acceptRequest);

    };

    const fetchWallets = async () => {
        try {
            setLoading(true);
            const response = await apiClient.getWallets();

            if (response.success && response.data) {
                const data = response.data as WalletsResponse;
                setWallets(data.wallets);
            }
        } catch (error) {
            console.error('Error fetching wallets:', error);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (user) {
            fetchWallets();
        }
    }, [user]);


    // 🔹 Reject
    const rejectRequest = async (user_id: number) => {
        try {
            const res = await apiClient.rejectRequest(user_id);
            if (res.success) {
                loadRequests();
            }
        } catch (err) {
            console.error("Reject error", err);
        }
    };

    // 🔹 Create Transfer
    const handleCreateRequests = async () => {
        // setIsLoading(true);
        // setCountdown(3);

        // const interval = setInterval(() => {
        //     setCountdown((prev) => {
        //         if (prev === 1) {
        //             clearInterval(interval);
        //             return 0;
        //         }
        //         return prev - 1;
        //     });
        // }, 1000);

        setTimeout(async () => {
            try {
                const response = await apiClient.createRequests({
                    email: formData.email,
                    amount: Number(formData.amount),
                    currency: formData.currency,
                });

                if (response.success) {
                    setShowCreateModal(false);
                    setFormData({
                        email: "",
                        amount: "",
                        currency: "USD",
                        // status: "",
                    });
                    loadRequests();
                }
            } catch (error) {
                console.error("Requests Create Error:", error);
            } finally {
                // setIsLoading(false);
                // setCountdown(3);
            }
        }, 3000);
    };

    // 🔹 Table Columns
    const requestsColumns = [
        {
            key: "sender",
            label: "Sender",
            render: (_: any, row: any) => (
                <div>
                    <div className="font-medium">{row.sender?.name}</div>
                    <div className="text-xs text-white-500">{row.sender?.email}</div>
                </div>
            ),
        },
        {
            key: "receiver",
            label: "Receiver",
            render: (_: any, row: any) => (
                <div>
                    <div className="font-medium">{row.receiver?.name}</div>
                    <div className="text-xs text-white text-gray-500">{row.receiver?.email}</div>
                </div>
            ),
        },
        {
            key: "amount",
            label: "Amount",
            render: (value: any, row: any) => (
                <span className="font-mono">
                    {Number(value || 0).toFixed(2)} {row.currency}
                </span>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (value: string) => {
                let color = "text-gray-500";

                if (value === "pending") color = "text-yellow-500 ";
                if (value === "accepted") color = "text-green-600";
                if (value === "rejected") color = "text-red-500";

                return (
                    <span className={`font-semibold capitalize ${color}`}>
                        {value}
                    </span>
                );


            },
        },

        {
            key: "action",
            label: "Action",
            render: (_: any, row: any) => {
                const currentUserId = user?.user_id;
                console.log(row.receiver_id, currentUserId);

                if (
                    row.receiver_id == currentUserId &&
                    row.status === "pending"
                ) {
                    return (
                        <div className="flex gap-2">
                            <button
                                onClick={() => acceptRequest(row.id)}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded "
                            >
                                Accept
                            </button>
                            <button
                                onClick={() => rejectRequest(row.id)}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                            >
                                Reject
                            </button>
                        </div>
                    );
                }

                // sender view
                if (row.sender_id === currentUserId) {
                    return (
                        <span className="text-xs text-gray-400 ">
                            Waiting...
                        </span>
                    );
                }

                return null;
            },
        },





        {
            key: "created_at",
            label: "Date",
            render: (value: string) =>
                new Date(value).toLocaleDateString(),
        },


    ];

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold dark:text-white">
                    Request Management
                </h1>

                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                    Create Request
                </button>
            </div>

            {/* Table */}
            <DataTable
                data={requests}
                columns={requestsColumns}
                loading={loading}
                searchPlaceholder="Search requests..."
            />

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Requests"
                size="md"
            >
                <div className="space-y-4">

                    {/* Receiver Email */}
                    <div>
                        <label className="block text-sm mb-1 text-white">
                            Receiver Email
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            placeholder="Receiver Email"
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    email: e.target.value,
                                })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm mb-1 text-white">
                            Amount
                        </label>
                        <input
                            type="number"
                            value={formData.amount}
                            placeholder="Amount"
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    amount: e.target.value,
                                })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>


                    {/* <select
                        value={formData.currency}
                        onChange={(e) =>
                            setFormData({ ...formData, currency: e.target.value })
                        }
                        className="w-full border p-2"
                    >
                        {availableCurrencies.map((cur) => (
                            <option key={cur} value={cur}>
                                {cur}
                            </option>
                        ))}
                    </select> */}


                    {/* Currency */}
                    <div>
                        <label className="block text-sm mb-1 text-white">
                            Currency
                        </label>
                        <select
                            value={formData.currency}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    currency: e.target.value,
                                })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {wallets.map((wallet) => (
                                <option key={wallet.id} value={wallet.currency}>
                                    {wallet.currency}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleCreateRequests}
                            // disabled={isLoading}
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

export default Requests;