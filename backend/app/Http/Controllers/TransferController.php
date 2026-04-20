<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Transfer;
use App\Models\PmntRequest;
use App\Models\Bank;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Currency;
use App\Models\CurrencyFxRate;

class TransferController extends Controller
{

    public function index()
    {
        $user = auth()->user();

        $transfers = Transfer::with(['sender', 'receiver'])
            ->where('sender_id', $user->id)
            ->orWhere('receiver_id', $user->id)
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $transfers
        ]);
    }


    public function store(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'currency' => 'required|string',
            'amount' => 'required|numeric|min:1',
            // 'adFee' => 'nullable|numeric|min:0|max:100',

        ]);

        //    $sender = auth()->user();
        $sender = User::where('user_id', auth()->user()->user_id)->first();
        $receiver = User::where('email', $request->email)->first();

        if (!$receiver) {
            return response()->json([
                'success' => false,
                'message' => 'Receiver not found'
            ], 404);
        }

        if ($sender->id === $receiver->id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot send money to yourself'
            ], 400);
        }

        $currency = strtoupper($request->currency);
        $amount = floatval($request->amount);
        $feePercent = floatval($sender->adFee);

        $fee = ($amount * $feePercent) / 100;
        $totalDeduct = $amount + $fee;

        $senderWallet = Wallet::where('user_id', $sender->user_id)
            ->where('currency', $currency)
            ->first();

        if (!$senderWallet) {
            return response()->json([
                'success' => false,
                'message' => "You don't have a $currency wallet"
            ], 400);
        }

        $receiverWallet = Wallet::firstOrCreate(
            [
                'user_id' => $receiver->user_id,
                'currency' => $currency
            ],

            [
                'balance' => 0,
                'status' => 'ACTIVE'
            ]
        );


        // $convertedAmount = $amount;

        // if ($currency !== $receiverWallet->currency) {
        //     try {
        //         $response = Http::get("https://open.er-api.com/v6/latest/" . $currency);
        //         if ($response->successful()) {
        //             $data = $response->json();
        //             $rate = $data['rates'][$receiverWallet->currency] ?? 1;
        //             $convertedAmount = $amount * $rate;
        //         }
        //     } catch (\Throwable $th) {
        //         $convertedAmount = $amount;
        //     }
        // }
        // $convertedAmount = round($convertedAmount, 2);


        // Balance check
        if ($senderWallet->balance < $totalDeduct) {
            return response()->json([
                'success' => false,
                'message' => 'Insufficient balance'
            ], 400);
        }


        $senderWallet->decrement('balance', $totalDeduct);
        $receiverWallet->increment('balance', $amount);

        $transfer = Transfer::create([
            'sender_id' => $sender->id,
            'receiver_id' => $receiver->id,
            'currency' => $currency,
            'amount' => $amount,
            'fee' => $fee,
        ]);



        return response()->json([
            'success' => true,
            // 'message' => 'Transfer completed successfully',
            'data' => $transfer->load(['sender', 'receiver'])
        ]);
    }


    // REQUEST METHODS


    public function requestIndex()
    {
        $user = auth()->user();

        $request = PmntRequest::with(['sender', 'receiver'])
            ->where('sender_id', $user->user_id)
            ->orWhere('receiver_id', $user->user_id)
            ->latest()
            ->get();



        return response()->json([
            'success' => true,
            'data' => $request,
        ]);
    }

    public function requestStore(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'currency' => 'required|string',
            'amount' => 'required|numeric|min:1',
        ]);

        $sender = auth()->user();
        $receiver = User::where('email', $request->email)->first();
        if (!$receiver) {
            return response()->json([
                'success' => false,
                'message' => 'Receiver not found'
            ]);
        }



        if ($sender->user_id === $receiver->user_id) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot request yourself'
            ]);
        }

        $pmntRequest = PmntRequest::create([
            'sender_id' => $sender->user_id,
            'receiver_id' => $receiver->user_id,
            'currency' => strtoupper($request->currency),
            'amount' => $request->amount,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Request sent',
            'data' => $pmntRequest
        ]);
    }

    public function acceptRequest($id)
    {
        $user = auth()->user();

        $request = PmntRequest::findOrFail($id);

        if ($request->receiver_id !== $user->user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($request->status !== 'pending') {
            return response()->json(['message' => 'Already processed']);
        }

        $senderWallet = Wallet::where('user_id', $request->sender_id)
            ->where('currency', $request->currency)
            ->first();

        $receiverWallet = Wallet::where('user_id', $request->receiver_id)
            ->where('currency', $request->currency)
            ->first();

        if ($receiverWallet->balance < $request->amount) {
            return response()->json([
                'message' => 'Insufficient balance'
            ], 400);
        }

        $receiverWallet->decrement('balance', $request->amount);

        $senderWallet->increment('balance', $request->amount);

        $request->status = 'accepted';
        $request->save();

        return response()->json(['success' => true]);
    }

    public function rejectRequest($id)
    {
        $user = auth()->user();

        $request = PmntRequest::findOrFail($id);

        if ($request->receiver_id !== $user->user_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->status = 'rejected';
        $request->save();

        return response()->json(['success' => true]);
    }




    public function bankIndex()
    {
        try {
            $user = auth()->user();

            $banks = Bank::where('user_id', $user->id)
                ->latest()
                ->get();

            return response()->json([
                'success' => true,
                'data' => $banks,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ]);
        }
    }

    public function bankstore(Request $request)
    {
        try {
            $user = auth()->user();

            $validated = $request->validate([
                'bankName' => 'required|string',
                'currency' => 'required|string',
                'bankBranch' => 'required|string',
                'bankAccoutntHolder' => 'required|string',
                'bankAccount' => 'required|string',
            ]);

            $bank = Bank::create([
                ...$validated,
                'user_id' => $user->id,
            ]);

            return response()->json([
                'success' => true,
                'data' => $bank,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ]);
        }
    }

    public function convert($amount, $fromCode, $toCode)
    {
        $fromCurrency = Currency::enabled()->where('code', strtoupper($fromCode))->first();
        $toCurrency = Currency::enabled()->where('code', strtoupper($toCode))->first();


        if (!$fromCurrency || !$toCurrency) {
            throw new \Exception('Currency not found');
        }

        $usd = Currency::where('code', 'USD')->first();
        $applyMarkup = function ($rate, $from, $to) {
            $fx = CurrencyFxRate::where('from_currency', $from)
                ->where('to_currency', $to)
                ->first();
            $markup = $fx ? $fx->bps / 100 : 0;
            return $rate * (1 - $markup);
        };


        if ($fromCurrency->code !== 'USD' && $toCurrency->code !== 'USD') {

            // FROM -> USD
            $rate1 = $usd->exchange_rate / $fromCurrency->exchange_rate;
            $rate1 = $applyMarkup($rate1, $fromCurrency->code, 'USD');

            // USD -> TO
            $rate2 = $toCurrency->exchange_rate / $usd->exchange_rate;
            $rate2 = $applyMarkup($rate2, 'USD', $toCurrency->code);
            $finalRate = $rate1 * $rate2;
        } else {

            $baseRate = $toCurrency->exchange_rate / $fromCurrency->exchange_rate;
            $finalRate = $applyMarkup(
                $baseRate,
                $fromCurrency->code,
                $toCurrency->code
            );
        }

        return $amount * $finalRate;
    }


    public function walletToBank(Request $request)
    {
        // $request->validate([
        //     'wallet_id' => 'required|exists:wallets,id',
        //     'amount' => 'required|numeric|min:1',
        //     'currency' => 'required|string',
        //     'bank_id' => 'required|exists:banks,id',
        // ]);

        $user = auth()->user();

        $wallet = Wallet::where('id', $request->wallet_id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$wallet || $wallet->balance < $request->amount) {
            return response()->json(['message' => 'Insufficient balance'], 400);
        }

        $bank = Bank::where('id', $request->bank_id)
            ->where('user_id', $user->id)
            ->first();

        if (!$bank) {
            return response()->json(['message' => 'Invalid bank'], 403);
        }


        $convertedAmount = $this->convert(
            $request->amount,
            $wallet->currency,
            $bank->currency
        );

        Transfer::create([
            'sender_id' => $user->id,
            'receiver_id' => $user->id,
            'currency' => $wallet->currency,
            'amount' => $request->amount,
            'fee' => 0,
            'type' => 'wallet_to_bank',
            'from_wallet_id' => $wallet->id,
            'to_bank_id' => $bank->id,
        ]);



        $wallet->decrement('balance', $request->amount);
        $bank->increment('balance', round($convertedAmount, 2));


        return response()->json([
            'success' => true,
            // 'message' => 'Transferred to bank successfully'
        ]);
    }

    public function bankToBank(Request $request)
    {
        // $request->validate([
        //     'from_bank_id' => 'required|exists:banks,id',
        //     'to_bank_id' => 'required|exists:banks,id',
        //     'amount' => 'required|numeric|min:1',
        //     'currency' => 'required|string',
        // ]);

        $user = auth()->user();

        $fromBank = Bank::where('id', $request->from_bank_id)
            ->where('user_id', $user->id)
            ->first();

        $toBank = Bank::where('id', $request->to_bank_id)
            ->where('user_id', $user->id)
            ->first();

        if (!$fromBank || !$toBank) {
            return response()->json(['message' => 'Invalid bank'], 403);
        }

        $convertedAmount = $this->convert(
            $request->amount,
            $fromBank->currency,
            $toBank->currency
        );



        if ($fromBank->balance < $request->amount) {
            return response()->json([
                'message' => 'Insufficient balance'
            ], 400);
        }
        $fromBank->decrement('balance', $request->amount);
        $toBank->increment('balance', round($convertedAmount, 2));

        Transfer::create([
            'sender_id' => $user->id,
            'receiver_id' => $user->id,
            'currency' => $fromBank->currency,
            'amount' => $request->amount,
            'fee' => 0,
            'type' => 'bank_to_bank',
            'from_bank_id' => $fromBank->id,
            'to_bank_id' => $toBank->id,
        ]);

        return response()->json(['success' => true]);
    }

    public function walletToMySelf(Request $request)
    {
        // $request->validate([
        //     'from_wallet_id' => 'required|exists:wallets,id',
        //     'to_wallet_id' => 'required|exists:wallets,id',
        //     'amount' => 'required|numeric|min:1',
        //     'currency' => 'required|string',
        // ]);

        $user = auth()->user();

        $fromWallet = Wallet::where('id', $request->from_wallet_id)
            ->where('user_id', $user->user_id)
            ->first();

        $toWallet = Wallet::where('id', $request->to_wallet_id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$fromWallet || !$toWallet) {
            return response()->json(['message' => 'Invalid wallet'], 403);
        }







        if ($fromWallet->balance < $request->amount) {
            return response()->json(['message' => 'Insufficient balance'], 400);
        }
        $convertedAmount = $this->convert(
            $request->amount,
            $fromWallet->currency,
            $toWallet->currency
        );



        $fromWallet->decrement('balance', $request->amount);
        $toWallet->increment('balance', round($convertedAmount, 2));

        Transfer::create([
            'sender_id' => $user->id,
            'receiver_id' => $user->id,
            'currency' => $fromWallet->currency,
            'amount' => $request->amount,
            'fee' => 0,
            'type' => 'wallet_to_myself',
        ]);

        return response()->json([
            'success' => true,
            // 'message' => 'Wallet transfer successful'
        ]);
    }
}
