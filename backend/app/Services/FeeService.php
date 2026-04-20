<?php

namespace App\Services;

use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Support\Facades\DB;

class FeeService
{
    /**
     * Calculate and distribute fees for a transaction
     */
    public function calculateAndDistributeFees(Transaction $transaction): array
    {
        $merchant = $transaction->merchant;
        $agent = $merchant->agent;
        $partner = $agent ? $agent->partner : null;

        // Get applicable fee policies
        $feePolicies = $this->getApplicableFeePolicies($transaction, $merchant, $agent, $partner);

        $totalFee = 0;
        $feeBreakdown = [];

        foreach ($feePolicies as $policy) {
            $fee = $policy->calculateFee($transaction->amount);
            $totalFee += $fee;

            $feeBreakdown[] = [
                'policy_id' => $policy->fee_id,
                'scope_type' => $policy->scope_type,
                'scope_id' => $policy->scope_id,
                'amount' => $fee,
                'currency' => $policy->currency
            ];
        }

        // Distribute fees
        $this->distributeFees($feeBreakdown, $transaction);

        // Update transaction with fee breakdown
        $transaction->update([
            'fee_breakdown' => $feeBreakdown,
            'estimated_cost' => $totalFee
        ]);

        return $feeBreakdown;
    }

    /**
     * Get applicable fee policies for the transaction
     */
    private function getApplicableFeePolicies(Transaction $transaction, $merchant, $agent, $partner): array
    {
        $policies = [];

        // Get policies for different scopes
        $scopes = [
            ['type' => 'MERCHANT', 'id' => $merchant->merchant_id],
            ['type' => 'AGENT', 'id' => $agent ? $agent->agent_id : null],
            ['type' => 'PARTNER', 'id' => $partner ? $partner->partner_id : null],
            ['type' => 'SUPER_ADMIN', 'id' => null]
        ];

        foreach ($scopes as $scope) {
            if (!$scope['id'] && $scope['type'] !== 'SUPER_ADMIN') continue;

            $scopePolicies = [];

            foreach ($scopePolicies as $policy) {
                if ($policy->isApplicableFor($scope['type'], $scope['id']) && $policy->matches($transaction->channel_type, $transaction->provider_alias)) {
                    $policies[] = $policy;
                }
            }
        }

        // Sort by override_lower_levels (higher priority first)
        usort($policies, function($a, $b) {
            return $b->override_lower_levels <=> $a->override_lower_levels;
        });

        // Remove overridden policies
        $filteredPolicies = [];
        foreach ($policies as $policy) {
            if ($policy->override_lower_levels) {
                // If this policy overrides lower levels, clear previous policies
                $filteredPolicies = [$policy];
            } else {
                $filteredPolicies[] = $policy;
            }
        }

        return $filteredPolicies;
    }

    /**
     * Distribute fees to respective wallets
     */
    private function distributeFees(array $feeBreakdown, Transaction $transaction): void
    {
        DB::transaction(function () use ($feeBreakdown, $transaction) {
            foreach ($feeBreakdown as $fee) {
                $user = $this->getUserForScope($fee['scope_type'], $fee['scope_id']);
                if (!$user) continue;

                $wallet = $user->wallets()->where('currency', $fee['currency'])->first();
                if (!$wallet) {
                    // Create wallet if doesn't exist
                    $wallet = Wallet::create([
                        'user_id' => $user->user_id,
                        'balance' => 0,
                        'currency' => $fee['currency']
                    ]);
                }

                $wallet->increment('balance', $fee['amount']);
            }
        });
    }

    /**
     * Get user for a given scope
     */
    private function getUserForScope(string $scopeType, string $scopeId): ?User
    {
        switch ($scopeType) {
            case 'MERCHANT':
                $merchant = \App\Models\Merchant::where('merchant_id', $scopeId)->first();
                return $merchant ? $merchant->user : null;
            case 'AGENT':
                $agent = \App\Models\Agent::where('agent_id', $scopeId)->first();
                return $agent ? $agent->user : null;
            case 'PARTNER':
                $partner = \App\Models\Partner::where('partner_id', $scopeId)->first();
                return $partner ? $partner->user : null;
            case 'SUPER_ADMIN':
                // Assume super admin has a specific user or role
                return User::where('role', 'super_admin')->first();
            default:
                return null;
        }
    }
}
