<?php

namespace App\Models\Meet;

use PDO;

class MeetModel
{
    protected PDO $db;

    public function __construct(?PDO $pdo = null)
    {
        $this->db = $pdo ?: new PDO('sqlite:' . __DIR__ . '/../../../database/database.sqlite');
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->ensureSchema();
    }

    protected function ensureSchema(): void
    {
        $this->db->exec(
            'CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account TEXT UNIQUE,
                password TEXT,
                email TEXT,
                name TEXT,
                description TEXT
            )'
        );
    }

    public function register(string $account, string $password, string $email): int
    {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $this->db->prepare('INSERT INTO users (account, password, email) VALUES (:account, :password, :email)');
        $stmt->execute([
            'account' => $account,
            'password' => $hash,
            'email' => $email,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function findByAccount(string $account): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE account = :account');
        $stmt->execute(['account' => $account]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        return $user ?: null;
    }

    public function verifyCredentials(string $account, string $password): ?array
    {
        $user = $this->findByAccount($account);
        if (!$user) {
            return null;
        }
        $hash = $user['password'];
        if (preg_match('/^[a-f0-9]{32}$/', $hash)) {
            if (md5($password) !== $hash) {
                return null;
            }
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $this->updatePassword((int) $user['id'], $hash);
            $user['password'] = $hash;
        } elseif (password_verify($password, $hash)) {
            if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
                $hash = password_hash($password, PASSWORD_DEFAULT);
                $this->updatePassword((int) $user['id'], $hash);
                $user['password'] = $hash;
            }
        } else {
            return null;
        }
        return $user;
    }

    protected function updatePassword(int $id, string $hash): void
    {
        $stmt = $this->db->prepare('UPDATE users SET password = :password WHERE id = :id');
        $stmt->execute([
            'password' => $hash,
            'id' => $id,
        ]);
    }

    public function updateProfile(int $id, array $data): void
    {
        $fields = [];
        $params = ['id' => $id];
        foreach (['name', 'email', 'description'] as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "$field = :$field";
                $params[$field] = $data[$field];
            }
        }
        if ($fields) {
            $sql = 'UPDATE users SET ' . implode(',', $fields) . ' WHERE id = :id';
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
        }
    }

    public function insertLegacy(string $account, string $md5Password, string $email): int
    {
        $stmt = $this->db->prepare('INSERT INTO users (account, password, email) VALUES (:account, :password, :email)');
        $stmt->execute([
            'account' => $account,
            'password' => $md5Password,
            'email' => $email,
        ]);
        return (int) $this->db->lastInsertId();
    }
}
