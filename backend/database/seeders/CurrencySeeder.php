<?php

namespace Database\Seeders;

use App\Models\Currency;
use Illuminate\Database\Seeder;

class CurrencySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $currencies = [
            ['code' => 'USD', 'name' => 'US Dollar', 'symbol' => '$', 'type' => 'fiat', 'precision' => 2, 'exchange_rate' => 1.0],
        ];

        foreach ($currencies as $currency) {
            Currency::create($currency);
        }
    }
}
