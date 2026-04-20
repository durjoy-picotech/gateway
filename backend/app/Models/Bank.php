<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bank extends Model
{
    protected $fillable = [
        'user_id',
        'bankName',
        'currency',
        'bankBranch',
        'bankAccoutntHolder',
        'bankAccount',
        'balance'

    ];
}




