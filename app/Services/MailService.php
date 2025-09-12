<?php

namespace App\Services;

use Illuminate\Support\Facades\Mail;

class MailService
{
    public function send($view, array $data, $callback)
    {
        Mail::send($view, $data, $callback);
    }
}

