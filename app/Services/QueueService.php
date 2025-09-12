<?php

namespace App\Services;

use Illuminate\Support\Facades\Queue;

class QueueService
{
    public function push($job, $data = '')
    {
        Queue::push($job, $data);
    }
}

