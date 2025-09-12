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

class RegistrationTest extends TestCase
{
    protected MeetController $controller;

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

        $session = new Store('test', new ArraySessionHandler(120));
        $this->controller = new MeetController($session, $validator, $hash);
    }

    public function testUserCanRegister(): void
    {
        $id = $this->controller->register([
            'account' => 'john',
            'password' => 'secret',
            'password_confirmation' => 'secret',
            'email' => 'john@example.com',
        ]);

        $this->assertIsInt($id);
        $user = User::where('account', 'john')->first();
        $this->assertNotNull($user);
        $this->assertTrue(password_verify('secret', $user->password));
    }
}
