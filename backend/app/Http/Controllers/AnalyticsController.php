<?php

namespace App\Http\Controllers;

use App\Models\Merchant;
use App\Models\Partner;
use App\Models\Agent;
use App\Models\Settlement;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Provider;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AnalyticsController extends Controller
{
    /**
     * Get dashboard analytics data.
     */
    public function dashboard(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'scope_type' => 'string|in:SUPER_ADMIN,PARTNER,AGENT,MERCHANT',
            'scope_id' => 'string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Invalid input data',
                    'details' => $validator->errors()
                ]
            ], 400);
        }

        $dateFrom = $request->date_from;
        $dateTo = $request->date_to;
        $scopeType = $request->scope_type ?? 'SUPER_ADMIN';
        $scopeId = $request->scope_id;

        // Build base query for transactions
        $transactionQuery = Transaction::whereBetween('created_at', [$dateFrom, $dateTo]);

        $user = User::where('user_id', $scopeId)->first();

        if (!$user) {
            // handle missing user gracefully
            return response()->json(['error' => 'Invalid scope ID or user not found'], 404);
        }

        if ($scopeType === 'PARTNER') {
            $transactionQuery->whereHas('merchant.agent', function ($query) use ($user) {
                $query->where('partner_id', $user->partner_id);
            });
        } elseif ($scopeType === 'AGENT') {
            $transactionQuery->whereHas('merchant', function ($query) use ($user) {
                $query->where('agent_id', $user->agent_id);
            });
        } elseif ($scopeType === 'MERCHANT') {
            $transactionQuery->where('merchant_id', $user->merchant_id);
        }
        // Calculate volume KPIs
        $totalVolume = (clone $transactionQuery)->sum('amount');
        $approvedVolume = (clone $transactionQuery)->where('status', 'SUCCESS')->sum('amount');
        $declinedVolume = (clone $transactionQuery)->where('status', 'FAILED')->sum('amount');

        $totalTransactions = (clone $transactionQuery)->count();
        $successfulTransactions = (clone $transactionQuery)->where('status', 'SUCCESS')->count();
        $failedTransactions = (clone $transactionQuery)->where('status', 'FAILED')->count();
        $CancelledTransactions = (clone $transactionQuery)->where('status', 'CANCELLED')->count();
        $approvalRate = $totalTransactions > 0 ? ($successfulTransactions / $totalTransactions) * 100 : 0;
        $declineRate = $totalTransactions > 0 ? ($failedTransactions / $totalTransactions) * 100 : 0;

        $approvalRateByCancelled = ($totalTransactions > 0 && $CancelledTransactions > 0)
            ? ($successfulTransactions / $CancelledTransactions) * 100
            : 0;

        $declineRateByCancelled = ($totalTransactions > 0)
            ? ($CancelledTransactions / $totalTransactions) * 100
            : 0;

        // Calculate fees and revenue
        $feeBreakdown = (clone $transactionQuery)->where('status', 'SUCCESS')
            ->selectRaw('SUM(JSON_EXTRACT(fee_breakdown, "$.gateway_fee")) as gateway_fees')
            ->selectRaw('SUM(JSON_EXTRACT(fee_breakdown, "$.processing_fee")) as processing_fees')
            ->first();

        $totalRevenue = ($feeBreakdown->gateway_fees ?? 0) + ($feeBreakdown->processing_fees ?? 0);

        // Revenue split calculation (simplified)
        $revenueSplit = [
            'superAdmin' => $totalRevenue * 0.3,
            'partners' => $totalRevenue * 0.4,
            'agents' => $totalRevenue * 0.2,
            'merchants' => $totalRevenue * 0.1
        ];

        // FX Margins
        $fxData = (clone $transactionQuery)->where('status', 'SUCCESS')
            ->whereNotNull('fx_rate')
            ->selectRaw('AVG(fx_rate) as avg_fx_rate, COUNT(*) as fx_transactions')
            ->first();

        $totalFxMargin = $approvedVolume * 0.001; // 0.1% margin
        $averageFxMarginBps = 10; // 10 basis points

        // Settlement Performance
        $settlementQuery = Settlement::whereBetween('created_at', [$dateFrom, $dateTo]);

        if ($scopeType === 'PARTNER' && $scopeId) {
            $settlementQuery->where('partner_id', $scopeId);
        } elseif ($scopeType === 'AGENT' && $scopeId) {
            $settlementQuery->where('agent_id', $scopeId);
        } elseif ($scopeType === 'MERCHANT' && $scopeId) {
            $settlementQuery->where('merchant_id', $scopeId);
        }

        $settlementStats = $settlementQuery->selectRaw('
                COUNT(*) as total_settlements,
                SUM(CASE WHEN status = "COMPLETED" THEN 1 ELSE 0 END) as successful_settlements,
                SUM(CASE WHEN status = "FAILED" THEN 1 ELSE 0 END) as failed_settlements,
                SUM(CASE WHEN status = "PENDING" THEN 1 ELSE 0 END) as pending_settlements,
                AVG(CASE WHEN status = "COMPLETED" AND processed_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, processed_at) END) as avg_settlement_time,
                SUM(total_amount) as settlement_volume,
                SUM(fee_amount) as settlement_fees
            ')->first();

        $settlementSuccessRate = $settlementStats->total_settlements > 0
            ? ($settlementStats->successful_settlements / $settlementStats->total_settlements) * 100
            : 0;

        // Channel type breakdown
        $channelBreakdown = (clone $transactionQuery)
            ->select('channel_type', DB::raw('COUNT(*) as count'), DB::raw('SUM(amount) as volume'), DB::raw('SUM(CASE WHEN status = "SUCCESS" THEN amount ELSE 0 END) as approved'), DB::raw('SUM(CASE WHEN status = "FAILED" THEN amount ELSE 0 END) as declined'))
            ->groupBy('channel_type')
            ->get()
            ->mapWithKeys(function ($item) {
                $approvalRate = $item->count > 0 ? (($item->approved / $item->volume) * 100) : 0;
                return [$item->channel_type => [
                    'volume' => $item->volume,
                    'approved' => $item->approved,
                    'declined' => $item->declined,
                    'approvalRate' => round($approvalRate, 2)
                ]];
            });

        // Provider breakdown
        $providerBreakdown = (clone $transactionQuery)
            ->select('provider_alias', DB::raw('COUNT(*) as count'), DB::raw('SUM(amount) as volume'), DB::raw('SUM(CASE WHEN status = "SUCCESS" THEN amount ELSE 0 END) as approved'), DB::raw('SUM(CASE WHEN status = "FAILED" THEN amount ELSE 0 END) as declined'))
            ->whereNotNull('provider_alias')
            ->groupBy('provider_alias')
            ->get()
            ->mapWithKeys(function ($item) {
                $approvalRate = $item->count > 0 ? (($item->approved / $item->volume) * 100) : 0;
                return [$item->provider_alias => [
                    'volume' => $item->volume,
                    'approved' => $item->approved,
                    'declined' => $item->declined,
                    'approvalRate' => round($approvalRate, 2)
                ]];
            });

        // Method breakdown (using channel_type as method)
        $methodBreakdown = (clone $transactionQuery)
            ->select('channel_type', DB::raw('COUNT(*) as count'), DB::raw('SUM(amount) as volume'), DB::raw('SUM(CASE WHEN status = "SUCCESS" THEN amount ELSE 0 END) as approved'), DB::raw('SUM(CASE WHEN status = "FAILED" THEN amount ELSE 0 END) as declined'))
            ->groupBy('channel_type')
            ->get()
            ->mapWithKeys(function ($item) {
                $approvalRate = $item->count > 0 ? (($item->approved / $item->volume) * 100) : 0;
                return [$item->channel_type => [
                    'volume' => $item->volume,
                    'approved' => $item->approved,
                    'declined' => $item->declined,
                    'approvalRate' => round($approvalRate, 4)
                ]];
            });

        // Variant breakdown (using transaction_type as variant)
        $variantBreakdown = (clone $transactionQuery)
            ->select('transaction_type', DB::raw('COUNT(*) as count'), DB::raw('SUM(amount) as volume'), DB::raw('SUM(CASE WHEN status = "SUCCESS" THEN amount ELSE 0 END) as approved'), DB::raw('SUM(CASE WHEN status = "FAILED" THEN amount ELSE 0 END) as declined'))
            ->groupBy('transaction_type')
            ->get()
            ->mapWithKeys(function ($item) {
                $approvalRate = $item->count > 0 ? (($item->approved / $item->volume) * 100) : 0;
                return [$item->transaction_type => [
                    'volume' => $item->volume,
                    'approved' => $item->approved,
                    'declined' => $item->declined,
                    'approvalRate' => round($approvalRate, 4)
                ]];
            });

        // Currency margins (grouped by currency since we don't have currency pairs)
        $currencyMargins = (clone $transactionQuery)
            ->where('status', 'SUCCESS')
            ->whereNotNull('fx_rate')
            ->selectRaw('currency, SUM(amount) as volume, SUM(amount * fx_rate * 0.001) as margin')
            ->groupBy('currency')
            ->get()
            ->mapWithKeys(function ($item) {
                $marginBps = $item->volume > 0 ? (($item->margin / $item->volume) * 10000) : 0;
                return [$item->currency => [
                    'volume' => $item->volume,
                    'margin' => $item->margin,
                    'marginBps' => round($marginBps, 2)
                ]];
            });

        // Margin trend (daily for last 7 days)
        $marginTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $dayMargin = (clone $transactionQuery)
                ->where('status', 'SUCCESS')
                ->whereNotNull('fx_rate')
                ->whereDate('created_at', $date)
                ->selectRaw('SUM(amount) as volume, SUM(amount * fx_rate * 0.001) as margin')
                ->first();

            $marginTrend[] = [
                'date' => $date,
                'margin' => $dayMargin->margin ?? 0,
                'volume' => $dayMargin->volume ?? 0
            ];
        }

        // Reserves, deposits, penalties (simplified calculation)
        $reserveData = [
            'totalReserves' => $approvedVolume * 0.05, // 5% reserve
            'availableReserves' => $approvedVolume * 0.04,
            'heldReserves' => $approvedVolume * 0.01,
            'deposits' => $approvedVolume * 0.03,
            'penalties' => $declinedVolume * 0.001,
            'reserveUtilization' => 0.2,
            'reserveTrend' => []
        ];

        // Reserve trend (last 7 days)
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $dayReserve = (clone $transactionQuery)
                ->whereDate('created_at', $date)
                ->selectRaw('SUM(CASE WHEN status = "SUCCESS" THEN amount * 0.05 ELSE 0 END) as reserves, SUM(CASE WHEN status = "SUCCESS" THEN amount * 0.03 ELSE 0 END) as deposits, SUM(CASE WHEN status = "FAILED" THEN amount * 0.001 ELSE 0 END) as penalties')
                ->first();

            $reserveData['reserveTrend'][] = [
                'date' => $date,
                'reserves' => $dayReserve->reserves ?? 0,
                'deposits' => $dayReserve->deposits ?? 0,
                'penalties' => $dayReserve->penalties ?? 0
            ];
        }

        // Notification stats (simplified - would need notification logs table)
        $notificationStats = [
            'totalSent' => $totalTransactions * 2, // Assume 2 notifications per transaction
            'delivered' => $successfulTransactions * 2,
            'failed' => $failedTransactions * 2,
            'deliveryRate' => $totalTransactions > 0 ? (($successfulTransactions * 2) / ($totalTransactions * 2)) * 100 : 0,
            'averageDeliveryTime' => 2.3,
            'byType' => [
                'email' => [
                    'sent' => $totalTransactions * 1.2,
                    'delivered' => $successfulTransactions * 1.2,
                    'failed' => $failedTransactions * 1.2,
                    'deliveryRate' => $totalTransactions > 0 ? (($successfulTransactions * 1.2) / ($totalTransactions * 1.2)) * 100 : 0
                ],
                'sms' => [
                    'sent' => $totalTransactions * 0.8,
                    'delivered' => $successfulTransactions * 0.8,
                    'failed' => $failedTransactions * 0.8,
                    'deliveryRate' => $totalTransactions > 0 ? (($successfulTransactions * 0.8) / ($totalTransactions * 0.8)) * 100 : 0
                ]
            ]
        ];

        // Build response
        $analytics = [
            'kpis' => [
                'volume' => [
                    'total' => $totalVolume,
                    'approved' => $approvedVolume,
                    'declined' => $declinedVolume,
                    'approvalRateByCancelled' => $approvalRateByCancelled,
                    'declineRateByCancelled' => $declineRateByCancelled,
                    'approvalRate' => round($approvalRate, 4),
                    'declineRate' => round($declineRate, 4),
                    'totalTransactions' => $totalTransactions
                ],
                'byChannelType' => $channelBreakdown,
                'byMethod' => $methodBreakdown,
                'byVariant' => $variantBreakdown,
                'byProviderAlias' => $providerBreakdown
            ],
            'fees' => [
                'totalRevenue' => $totalRevenue,
                'revenueSplit' => $revenueSplit,
                'feeBreakdown' => [
                    'gatewayFees' => $feeBreakdown->gateway_fees ?? 0,
                    'processingFees' => $feeBreakdown->processing_fees ?? 0,
                    'fxFees' => $totalFxMargin,
                    'reserveFees' => $reserveData['totalReserves'] * 0.1
                ]
            ],
            'fxMargins' => [
                'totalMargin' => $totalFxMargin,
                'averageMarginBps' => $averageFxMarginBps,
                'marginByCurrencyPair' => $currencyMargins,
                'marginTrend' => $marginTrend
            ],
            'settlementPerformance' => [
                'totalSettlements' => $settlementStats->total_settlements ?? 0,
                'successfulSettlements' => $settlementStats->successful_settlements ?? 0,
                'failedSettlements' => $settlementStats->failed_settlements ?? 0,
                'pendingSettlements' => $settlementStats->pending_settlements ?? 0,
                'averageSettlementTime' => $settlementStats->avg_settlement_time ?? 0,
                'settlementSuccessRate' => round($settlementSuccessRate, 4),
                'settlementVolume' => $settlementStats->settlement_volume ?? 0,
                'settlementFees' => $settlementStats->settlement_fees ?? 0
            ],
            'reservesDepositsPenalties' => $reserveData,
            'bankReconciliation' => [
                'totalTransactions' => $totalTransactions,
                'reconciledTransactions' => $successfulTransactions,
                'unreconciledTransactions' => $failedTransactions,
                'reconciliationRate' => round($approvalRate, 4),
                'discrepancies' => 0,
                'discrepancyAmount' => 0,
                'lastReconciliationDate' => now()->toISOString()
            ],
            'notificationStats' => $notificationStats,
            'dateRange' => [
                'start' => $dateFrom,
                'end' => $dateTo
            ]
        ];

        return response()->json([
            'success' => true,
            'data' => $analytics
        ]);
    }

    /**
     * Export analytics data.
     */
    public function export(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'format' => 'required|string|in:CSV,PDF',
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'scope_type' => 'string|in:SUPER_ADMIN,PARTNER,AGENT,MERCHANT',
            'scope_id' => 'string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Invalid input data',
                    'details' => $validator->errors()
                ]
            ], 400);
        }

        // Get analytics data (same as dashboard)
        $analyticsData = $this->dashboard($request)->getData();

        if ($request->format === 'CSV') {
            // Generate CSV export
            $filename = 'analytics_export_' . now()->format('Y-m-d_H-i-s') . '.csv';

            // In a real implementation, this would generate a proper CSV file
            // For now, return a placeholder response
            return response()->json([
                'success' => true,
                'message' => 'CSV export would be generated here',
                'filename' => $filename,
                'data' => $analyticsData->data
            ]);
        } else {
            // Generate PDF export
            $filename = 'analytics_report_' . now()->format('Y-m-d_H-i-s') . '.pdf';

            // In a real implementation, this would generate a proper PDF file
            // For now, return a placeholder response
            return response()->json([
                'success' => true,
                'message' => 'PDF export would be generated here',
                'filename' => $filename,
                'data' => $analyticsData->data
            ]);
        }
    }

    /**
     * Get dashboard data for the authenticated user based on their role.
     */
    public function getDashboard(Request $request)
    {
        $user = auth()->user();
        $role = $user->role;
        // Date range for calculations (last 30 days)
        $dateFrom = now()->subDays(30)->toDateString();
        $dateTo = now()->toDateString();
       $latestSettlement = null;
        // Base transaction query
        $settlements = Settlement::query();

        $transactionQuery = Transaction::with(['merchant.user','provider', 'partner.user', 'agent.user']);
        // Apply scope filtering based on role
        // if ($role === 'PARTNER') {
        //     $transactionQuery->whereHas('merchant.agent', function ($query) use ($user) {
        //         $query->where('partner_id', $user->partner_id);
        //     });
        // }

        if ($role === 'PARTNER') {
            $settlements->where('partner_id', $user->partner_id);
            $transactionQuery->where(function ($query) use ($user) {
            $query->where('partner_id', $user->partner_id)
                    ->orWhereHas('merchant.agent', function ($q) use ($user) {
                        $q->where('partner_id', $user->partner_id);
                    });
            });
        }
        elseif ($role === 'AGENT') {
            $settlements->where('agent_id', $user->agent_id);

            $transactionQuery->whereHas('merchant', function ($query) use ($user) {
                $query->where('agent_id', $user->agent_id);
            });
        } elseif ($role === 'MERCHANT') {
            $transactionQuery->where('merchant_id', $user->merchant_id);
            $settlements->where('merchant_id', $user->merchant_id);
        }



        $latestSettlement = $settlements->latest('created_at')->first();


        $baseQuery = Transaction::with(['merchant', 'provider', 'partner', 'agent'])
            ->orderBy('created_at', 'desc');
        if ($user->role !== 'SUPER_ADMIN') {
            if ($user->role === 'AGENT') {
                $baseQuery->where('agent_id', $user->agent_id)->where('for', $user->role);
            } elseif ($user->role === 'PARTNER') {
                $baseQuery->where('partner_id', $user->partner_id)->where('for', $user->role);
            } else {
                $baseQuery->where('merchant_id', $user->merchant_id)->where('for', $user->role);
            }
        } else {
            $baseQuery->where('superadmin_id', $user->user_id)->where('for', $user->role);
        }
        if ($request->has('currency')) {
            $baseQuery->where('currency', $request->currency);
        }
        $lifetimeTotal = (clone $baseQuery)->sum('amount');

        // Calculate basic metrics
        $totalVolume = (clone $transactionQuery)->sum('amount');
        $successfulTransactions = (clone $transactionQuery)->where('status', 'SUCCESS')->count();
        $totalTransactions = (clone $transactionQuery)->count();
        $successRate = $totalTransactions > 0 ? ($successfulTransactions / $totalTransactions) * 100 : 0;

        // Calculate revenue (simplified)
        $revenue = $totalVolume * 0.02; // Assume 2% fee

        // Get recent transactions
        $recentTransactions = (clone $transactionQuery)
            // ->with(['merchant'])
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($transaction) {
                return [
                    'txn_id' => $transaction->txn_id,
                    'amount' => $transaction->amount,
                    'currency' => $transaction->currency,
                     'transaction_type' => $transaction->transaction_type,
                    'status' => $transaction->status,
                     'provider_alias' => $transaction->provider?->alias ?? '',
                    'created_at' => $transaction->created_at,
                    'partner' => $transaction->partner?->user->email ?? '',
                    'agent' => $transaction->agent?->user->email ?? '',
                    'merchant' => $transaction->merchant ? $transaction->merchant->name : null,
                ];
            });

        // Build stats based on role
        $stats = [];
        switch ($role) {
            case 'SUPER_ADMIN':
                $activePartners = Partner::where('status', 'ACTIVE')->count();
                $stats = [
                    // [
                    //     'title' => 'Total Revenue',
                    //     'value' => '$' . number_format($lifetimeTotal, 0),
                    //     'change' => '+12.5%', // TODO: calculate actual change
                    //     'trend' => 'up'
                    // ],
                    [
                        'title' => 'Active Partners',
                        'value' => (string)$activePartners,
                        'change' => '+3',
                        'trend' => 'up'
                    ],
                    [
                        'title' => 'Total Transactions',
                        'value' => number_format($totalTransactions),
                        'change' => '+8.2%',
                        'trend' => 'up'
                    ],
                    [
                        'title' => 'Success Rate',
                        'value' => number_format($successRate, 1) . '%',
                        'change' => '+0.3%',
                        'trend' => 'up'
                    ]
                ];
                break;

            case 'PARTNER':
                $activeAgents = Agent::where('partner_id', $user->partner_id)->where('status', 'ACTIVE')->count();
                $totalMerchants = Merchant::whereHas('agent', function ($query) use ($user) {
                    $query->where('partner_id', $user->partner_id);
                })->count();
                $stats = [
                    // [
                    //     'title' => 'Monthly Revenue',
                    //     'value' => '$' . number_format($revenue, 0),
                    //     'change' => '+15.2%',
                    //     'trend' => 'up'
                    // ],
                    [
                        'title' => 'Active Agents',
                        'value' => (string)$activeAgents,
                        'change' => '+1',
                        'trend' => 'up'
                    ],
                    [
                        'title' => 'Transactions',
                        'value' => number_format($totalTransactions),
                        'change' => '+12.1%',
                        'trend' => 'up'
                    ],
                    [
                        'title' => 'Success Rate',
                        'value' => number_format($successRate, 1) . '%',
                        'change' => '-0.2%',
                        'trend' => 'down'
                    ]
                ];
                break;

            case 'AGENT':
                $activeMerchants = Merchant::where('agent_id', $user->agent_id)->where('status', 'ACTIVE')->count();
                $commission = $revenue * 0.1; // Assume 10% commission
                $stats = [
                    // [
                    //     'title' => 'Commission',
                    //     'value' => '$' . number_format($commission, 0),
                    //     'change' => '+18.5%',
                    //     'trend' => 'up'
                    // ],
                    [
                        'title' => 'Active Merchants',
                        'value' => (string)$activeMerchants,
                        'change' => '+4',
                        'trend' => 'up'
                    ],
                    [
                        'title' => 'Transactions',
                        'value' => number_format($totalTransactions),
                        'change' => '+22.3%',
                        'trend' => 'up'
                    ],
                    [
                        'title' => 'Success Rate',
                        'value' => number_format($successRate, 1) . '%',
                        'change' => '+0.5%',
                        'trend' => 'up'
                    ]
                ];
                break;

            case 'MERCHANT':
                $todayTransactions = (clone $transactionQuery)->whereDate('created_at', now()->toDateString())->count();
                $avgOrderValue = $totalTransactions > 0 ? $totalVolume / $totalTransactions : 0;
                $stats = [
                    // [
                    //     'title' => 'Today\'s Revenue',
                    //     'value' => '$' . number_format($totalVolume, 0),
                    //     'change' => '+25.8%',
                    //     'trend' => 'up'
                    // ],
                    [
                        'title' => 'Today\'s Orders',
                        'value' => (string)$todayTransactions,
                        'change' => '+12',
                        'trend' => 'up'
                    ],
                    [
                        'title' => 'Success Rate',
                        'value' => number_format($successRate, 1) . '%',
                        'change' => '+1.2%',
                        'trend' => 'up'
                    ],
                    [
                        'title' => 'Avg. Order Value',
                        'value' => '$' . number_format($avgOrderValue, 2),
                        'change' => '+5.3%',
                        'trend' => 'up'
                    ]
                ];
                break;
        }

        // Role-specific data
        $roleData = [];
        switch ($role) {
            case 'SUPER_ADMIN':
                $activeProviders = Provider::where('status', 'active')->count();
                $avgResponseTime = 145; // TODO: calculate from logs
                $roleData = [
                    'platformHealth' => [
                        'systemUptime' => '99.98%',
                        'activeProviders' => $activeProviders . '/14',
                        'avgResponseTime' => $avgResponseTime . 'ms'
                    ],
                    'recentAlerts' => [
                        ['type' => 'warning', 'message' => 'Provider ABC experiencing latency'],
                        ['type' => 'success', 'message' => 'New partner onboarded successfully']
                    ]
                ];
                break;

            case 'PARTNER':
                $activeAgents = Agent::where('partner_id', $user->partner_id)->where('status', 'ACTIVE')->count();
                $totalMerchants = Merchant::whereHas('agent', function ($query) use ($user) {
                    $query->where('partner_id', $user->partner_id);
                })->count();
                $monthlyVolume = $totalVolume;
                $roleData = [
                    'agentPerformance' => [
                        'activeAgents' => $activeAgents,
                        'totalMerchants' => $totalMerchants,
                        'monthlyVolume' => $monthlyVolume
                    ]
                ];
                break;

            case 'AGENT':
                $merchantStatuses = Merchant::where('agent_id', $user->agent_id)
                    ->selectRaw('status, COUNT(*) as count')
                    ->groupBy('status')
                    ->pluck('count', 'status');
                $roleData = [
                    'merchantStatusOverview' => [
                        'active' => $merchantStatuses['ACTIVE'] ?? 0,
                        'pendingKYB' => $merchantStatuses['PENDING_KYB'] ?? 0,
                        'suspended' => $merchantStatuses['SUSPENDED'] ?? 0,
                        'inactive' => $merchantStatuses['INACTIVE'] ?? 0
                    ]
                ];
                break;

            case 'MERCHANT':
                $walletInfo = null;
                $walletInfo = Wallet::where('user_id',$user->user_id)->first();
                $paymentMethods = (clone $transactionQuery)
                    ->select('channel_type', DB::raw('COUNT(*) as count'))
                    ->groupBy('channel_type')
                    ->get()
                    ->mapWithKeys(function ($item) {
                        return [$item->channel_type => $item->count];
                    });
                $totalPayments = array_sum($paymentMethods->values()->toArray());
                $roleData = [
                    // 'paymentMethods' => [
                    //     'creditCards' => $totalPayments > 0 ? (($paymentMethods['CREDIT_CARD'] ?? 0) / $totalPayments) * 100 : 0,
                    //     'bankTransfer' => $totalPayments > 0 ? (($paymentMethods['BANK_TRANSFER'] ?? 0) / $totalPayments) * 100 : 0,
                    //     'digitalWallets' => $totalPayments > 0 ? (($paymentMethods['DIGITAL_WALLET'] ?? 0) / $totalPayments) * 100 : 0
                    // ],

                   'walletInfo' => [
                    'balance' => (float) ($walletInfo?->balance ?? 0),
                    'currency' => $walletInfo?->currency ?? "",
                    ],

                'settlementInformation' => [
               'settlementDate' => $latestSettlement ? $latestSettlement->created_at->format('l, d M Y h:i A') : '',
                 'amount' => (float) ($latestSettlement?->total_amount ?? 0),
                 'status' => $latestSettlement?->status ?? '',
                'settlementCurrency' => $latestSettlement?->currency ??'',
                    ]
                ];
           break;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'roleData' => $roleData,
                'recentTransactions' => $recentTransactions
            ]
        ]);
    }
}
