<?php

namespace App\Http\Controllers;

use App\Models\Meet\MeetModel;

class MeetController
{
    protected MeetModel $model;

    public function __construct(?MeetModel $model = null)
    {
        $this->model = $model ?: new MeetModel();
    }

    public function register(array $data): int
    {
        return $this->model->register($data['account'], $data['password'], $data['email']);
    }

    public function login(array $data): ?array
    {
        return $this->model->verifyCredentials($data['account'], $data['password']);
    }

    public function updateProfile(int $id, array $data): void
    {
        $this->model->updateProfile($id, $data);
    }
}
