<?php

namespace Tests\Feature;

use PDO;
use PHPUnit\Framework\TestCase;
use App\Http\Controllers\MeetController;
use App\Models\Meet\MeetModel;

class LoginTest extends TestCase
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

    public function testLegacyPasswordIsUpgradedOnLogin(): void
    {
        $this->model->insertLegacy('legacy', md5('secret'), 'legacy@example.com');
        $user = $this->controller->login([
            'account' => 'legacy',
            'password' => 'secret',
        ]);
        $this->assertNotNull($user);
        $this->assertTrue(password_verify('secret', $user['password']));
        $this->assertFalse(preg_match('/^[a-f0-9]{32}$/', $user['password']) === 1);
    }
}
