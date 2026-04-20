<?php

namespace App\Services;

use App\Models\Provider;
use App\Models\Transaction;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymentService
{
    /**
     * Initiate payment with a provider
     */
    public function initiatePayment(Transaction $transaction, string $providerAlias, array $paymentData): array
    {
        $provider = Provider::where('alias', $providerAlias)->first();
        if (!$provider) {
            throw new \Exception("Provider {$providerAlias} not found");
        }

        switch ($providerAlias) {
            case 'paypal':
                return $this->initiatePayPalPayment($transaction, $paymentData);
            case 'stripe':
                return $this->initiateStripePayment($transaction, $paymentData);
            default:
                throw new \Exception("Unsupported provider: {$providerAlias}");
        }
    }

    /**
     * Initiate PayPal payment
     */
    private function initiatePayPalPayment(Transaction $transaction, array $paymentData): array
    {
        // PayPal API integration
        $paypalConfig = config('services.paypal');
        $accessToken = $this->getPayPalAccessToken($paypalConfig);

        $payload = [
            'intent' => 'CAPTURE',
            'purchase_units' => [
                [
                    'reference_id' => $transaction->txn_id,
                    'amount' => [
                        'currency_code' => $transaction->currency,
                        'value' => number_format($transaction->amount, 2, '.', '')
                    ]
                ]
            ],
            'application_context' => [
                'return_url' => route('payment.success', ['txn_id' => $transaction->txn_id]),
                'cancel_url' => route('payment.cancel', ['txn_id' => $transaction->txn_id])
            ]
        ];

        $response = Http::withToken($accessToken)
            ->post("{$paypalConfig['base_url']}/v2/checkout/orders", $payload);

        if ($response->successful()) {
            $data = $response->json();
            $approvalUrl = collect($data['links'])->firstWhere('rel', 'approve')['href'];

            return [
                'provider_order_id' => $data['id'],
                'payment_url' => $approvalUrl,
                'status' => 'PENDING'
            ];
        }

        Log::error('PayPal payment initiation failed', ['response' => $response->body()]);
        throw new \Exception('Failed to initiate PayPal payment');
    }

    /**
     * Initiate Stripe payment
     */
    private function initiateStripePayment(Transaction $transaction, array $paymentData): array
    {
        // Stripe API integration
        $stripeConfig = config('services.stripe');

        $payload = [
            'amount' => intval($transaction->amount * 100), // Convert to cents
            'currency' => strtolower($transaction->currency),
            'payment_method_types' => ['card'],
            'mode' => 'payment',
            'success_url' => route('payment.success', ['txn_id' => $transaction->txn_id]),
            'cancel_url' => route('payment.cancel', ['txn_id' => $transaction->txn_id]),
            'metadata' => [
                'txn_id' => $transaction->txn_id
            ]
        ];

        $response = Http::withToken($stripeConfig['secret'])
            ->asForm()
            ->post('https://api.stripe.com/v1/checkout/sessions', $payload);

        if ($response->successful()) {
            $data = $response->json();

            return [
                'provider_order_id' => $data['id'],
                'payment_url' => $data['url'],
                'status' => 'PENDING'
            ];
        }

        Log::error('Stripe payment initiation failed', ['response' => $response->body()]);
        throw new \Exception('Failed to initiate Stripe payment');
    }

    /**
     * Get PayPal access token
     */
    private function getPayPalAccessToken(array $config): string
    {
        $response = Http::withBasicAuth($config['client_id'], $config['client_secret'])
            ->asForm()
            ->post("{$config['base_url']}/v1/oauth2/token", [
                'grant_type' => 'client_credentials'
            ]);

        if ($response->successful()) {
            return $response->json()['access_token'];
        }

        throw new \Exception('Failed to get PayPal access token');
    }

    /**
     * Verify payment status with provider
     */
    public function verifyPayment(Transaction $transaction): bool
    {
        $providerAlias = $transaction->provider_alias;

        switch ($providerAlias) {
            case 'paypal':
                return $this->verifyPayPalPayment($transaction);
            case 'stripe':
                return $this->verifyStripePayment($transaction);
            default:
                return false;
        }
    }

    /**
     * Verify PayPal payment
     */
    private function verifyPayPalPayment(Transaction $transaction): bool
    {
        $paypalConfig = config('services.paypal');
        $accessToken = $this->getPayPalAccessToken($paypalConfig);

        $response = Http::withToken($accessToken)
            ->get("{$paypalConfig['base_url']}/v2/checkout/orders/{$transaction->provider_order_id}");

        if ($response->successful()) {
            $data = $response->json();
            return $data['status'] === 'COMPLETED';
        }

        return false;
    }

    /**
     * Verify Stripe payment
     */
    private function verifyStripePayment(Transaction $transaction): bool
    {
        $stripeConfig = config('services.stripe');

        $response = Http::withToken($stripeConfig['secret'])
            ->get("https://api.stripe.com/v1/checkout/sessions/{$transaction->provider_order_id}");

        if ($response->successful()) {
            $data = $response->json();
            return $data['payment_status'] === 'paid';
        }

        return false;
    }
}