<?php

namespace Tests\Feature;

use PDO;
use PHPUnit\Framework\TestCase;
use App\Http\Controllers\MeetController;
use App\Models\Meet\MeetModel;

class ProfileUpdateTest extends TestCase
{
    protected PDO $pdo;
    protected MeetModel $model;
    protected MeetController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pdo = new PDO('sqlite::memory:');
        $this->model = new MeetModel($this->pdo);
        $this->controller = new MeetController($this->model);
    }

    public function testUserCanUpdateProfile(): void
    {
        $id = $this->controller->register([
            'account' => 'john',
            'password' => 'secret',
            'email' => 'john@example.com',
        ]);
        $this->controller->updateProfile($id, [
            'name' => 'John',
            'description' => 'Hello',
        ]);
        $user = $this->model->findByAccount('john');
        $this->assertSame('John', $user['name']);
        $this->assertSame('Hello', $user['description']);
    }
}
