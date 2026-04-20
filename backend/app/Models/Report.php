<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Report extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'type',
        'parameters',
        'format',
        'file_path',
        'status',
    ];

    protected $casts = [
        'parameters' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}