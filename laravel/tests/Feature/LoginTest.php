<?php

namespace Tests\Feature;

use App\Http\Controllers\MeetController;
use App\Models\User;
use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Events\Dispatcher;
use Illuminate\Hashing\HashManager;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as Validator;
use PHPUnit\Framework\TestCase;

class LoginTest extends TestCase
{
    protected MeetController $controller;
    protected Store $session;

    protected function setUp(): void
    {
        parent::setUp();

        $container = new Container();
        Container::setInstance($container);
        $container->instance('config', ['hashing' => ['driver' => 'bcrypt'], 'database' => []]);

        $capsule = new Capsule($container);
        $capsule->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']);
        $capsule->setEventDispatcher(new Dispatcher($container));
        $capsule->setAsGlobal();
        $capsule->bootEloquent();

        $migration = require __DIR__ . '/../../database/migrations/2024_01_01_000000_create_users_table.php';
        $migration->up();

        $translator = new Translator(new ArrayLoader(), 'en');
        $validator = new Validator($translator, $container);
        $hash = new HashManager($container);

        $this->session = new Store('test', new ArraySessionHandler(120));
        $this->controller = new MeetController($this->session, $validator, $hash);
    }

    public function testLegacyPasswordIsUpgradedOnLogin(): void
    {
        User::create([
            'account' => 'legacy',
            'password' => md5('secret'),
            'email' => 'legacy@example.com',
        ]);

        $user = $this->controller->login([
            'account' => 'legacy',
            'password' => 'secret',
        ]);

        $this->assertNotNull($user);
        $this->assertTrue(password_verify('secret', $user->password));
        $this->assertFalse(preg_match('/^[a-f0-9]{32}$/', $user->password) === 1);
        $this->assertSame($user->id, $this->session->get('LOGIN_ID'));
    }
}
