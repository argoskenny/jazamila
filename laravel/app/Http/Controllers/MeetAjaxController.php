<?php

namespace App\Http\Controllers;

use App\Models\Meet\MeetModel;

class MeetAjaxController
{
    protected MeetModel $model;

    public function __construct(?MeetModel $model = null)
    {
        $this->model = $model ?: new MeetModel();
    }

    public function updateProfile(int $id, array $data): void
    {
        $this->model->updateProfile($id, $data);
    }
}
