<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Container\Container;
use Illuminate\Hashing\HashManager;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as Validator;

class MeetController
{
    protected Store $session;
    protected Validator $validator;
    protected HashManager $hash;

    public function __construct(?Store $session = null, ?Validator $validator = null, ?HashManager $hash = null)
    {
        $container = Container::getInstance();
        if (! $container->bound('config')) {
            $container->instance('config', ['hashing' => ['driver' => 'bcrypt']]);
        }
        $this->session = $session ?: new Store('session', new ArraySessionHandler(120));
        $this->validator = $validator ?: new Validator(new Translator(new ArrayLoader(), 'en'), $container);
        $this->hash = $hash ?: new HashManager($container);
    }

    public function register(array $data): int
    {
        $this->validator->make($data, [
            'account' => 'required|alpha_num|min:3|unique:users,account',
            'password' => 'required|alpha_num|min:4|confirmed',
            'email' => 'required|email|unique:users,email',
        ])->validate();

        $user = User::create([
            'account' => $data['account'],
            'password' => $this->hash->make($data['password']),
            'email' => $data['email'],
        ]);

        return $user->id;
    }

    public function login(array $data): ?User
    {
        $this->validator->make($data, [
            'account' => 'required',
            'password' => 'required',
        ])->validate();

        $user = User::where('account', $data['account'])->first();
        if (! $user) {
            return null;
        }

        $hash = $user->password;
        $password = $data['password'];

        if (preg_match('/^[a-f0-9]{32}$/', $hash)) {
            if (md5($password) !== $hash) {
                return null;
            }
            $hash = $this->hash->make($password);
            $user->password = $hash;
            $user->save();
        } elseif ($this->hash->check($password, $hash)) {
            if ($this->hash->needsRehash($hash)) {
                $user->password = $this->hash->make($password);
                $user->save();
            }
        } else {
            return null;
        }

        $this->session->put('LOGIN_ID', $user->id);
        return $user;
    }

    public function updateProfile(int $id, array $data): void
    {
        $this->validator->make($data, [
            'name' => 'nullable|string',
            'email' => 'nullable|email',
            'description' => 'nullable|string',
        ])->validate();

        $user = User::findOrFail($id);
        $user->fill($data);
        $user->save();
    }
}
