<?php

namespace Tests\Feature;

use PDO;
use PHPUnit\Framework\TestCase;
use App\Http\Controllers\MeetController;
use App\Models\Meet\MeetModel;

class RegistrationTest extends TestCase
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

    public function testUserCanRegister(): void
    {
        $id = $this->controller->register([
            'account' => 'john',
            'password' => 'secret',
            'email' => 'john@example.com',
        ]);
        $this->assertIsInt($id);
        $user = $this->model->findByAccount('john');
        $this->assertNotNull($user);
        $this->assertTrue(password_verify('secret', $user['password']));
    }
}
