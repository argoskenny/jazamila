<?php

namespace App\Services;

class RecaptchaService
{
    protected $siteKey;
    protected $secretKey;

    public function __construct()
    {
        $this->siteKey   = env('RECAPTCHA_SITE_KEY');
        $this->secretKey = env('RECAPTCHA_SECRET_KEY');
    }

    public function render()
    {
        return '<div class="g-recaptcha" data-sitekey="' . $this->siteKey . '"></div>';
    }

    public function verify($response, $ip)
    {
        $data = http_build_query([
            'secret'   => $this->secretKey,
            'response' => $response,
            'remoteip' => $ip,
        ]);

        $opts = ['http' => ['method' => 'POST', 'header' => 'Content-type: application/x-www-form-urlencoded', 'content' => $data]];
        $context  = stream_context_create($opts);
        $result = file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, $context);

        $json = json_decode($result, true);
        return $json['success'] ?? false;
    }
}

