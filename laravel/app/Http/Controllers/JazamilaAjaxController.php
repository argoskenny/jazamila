<?php
namespace App\Http\Controllers;

/**
 * Simple Request object used for tests.
 */
class SimpleRequest
{
    public array $post;
    public array $cookies;
    public array $session;

    public function __construct(array $post = [], array $cookies = [], array &$session = [])
    {
        $this->post = $post;
        $this->cookies = $cookies;
        $this->session = &$session;
    }

    public function input(string $key, $default = null)
    {
        return $this->post[$key] ?? $default;
    }
}

/**
 * Simple Response object to hold content, headers and cookies.
 */
class SimpleResponse
{
    private string $content;
    private int $status;
    private array $headers = [];

    public function __construct(string $content = '', int $status = 200, array $headers = [])
    {
        $this->content = $content;
        $this->status = $status;
        $this->headers = $headers;
    }

    public function setContent(string $content): void
    {
        $this->content = $content;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function header(string $name, string $value): void
    {
        $this->headers[$name] = $value;
    }

    public function addCookie(string $name, string $value, int $expire): void
    {
        $cookie = sprintf('%s=%s; expires=%s; path=/',
            $name,
            rawurlencode($value),
            gmdate('D, d M Y H:i:s', $expire) . ' GMT'
        );
        $this->headers['Set-Cookie'][] = $cookie;
    }

    public function getHeader(string $name)
    {
        return $this->headers[$name] ?? null;
    }

    /**
     * @return array<int,string>
     */
    public function getCookies(): array
    {
        return $this->headers['Set-Cookie'] ?? [];
    }
}

/**
 * Controller ported from CodeIgniter to a simple PHP implementation
 * to facilitate testing without the full Laravel framework.
 */
class JazamilaAjaxController
{
    /**
     * Hardcoded restaurant data used for random selection tests.
     * @var array<int,array<string,int>>
     */
    private array $restaurants = [
        ['id' => 1, 'res_region' => 1, 'res_section' => 2, 'res_price' => 50,  'res_foodtype' => 1],
        ['id' => 2, 'res_region' => 1, 'res_section' => 3, 'res_price' => 150, 'res_foodtype' => 2],
        ['id' => 3, 'res_region' => 2, 'res_section' => 1, 'res_price' => 200, 'res_foodtype' => 1],
    ];

    /**
     * Random restaurant selection with cookie handling.
     */
    public function pick(SimpleRequest $request): SimpleResponse
    {
        $foodwhere_region = (int)$request->input('foodwhere_region', 0);
        $foodwhere_section = (int)$request->input('foodwhere_section', 0);
        $foodmoney_max = (int)$request->input('foodmoney_max', 0);
        $foodmoney_min = (int)$request->input('foodmoney_min', 0);
        $foodtype = (int)$request->input('foodtype', 0);
        $remember = (int)$request->input('remember', 0);

        $response = new SimpleResponse('', 200, ['Content-Type' => 'application/json']);

        // Handle cookies similar to CodeIgniter implementation
        if ($remember === 1) {
            $expire = time() + 8650000;
            $this->setRememberCookies($response, [
                'remember' => $remember,
                'foodwhere_region' => $foodwhere_region,
                'foodwhere_section' => $foodwhere_section,
                'foodmoney_max' => $foodmoney_max,
                'foodmoney_min' => $foodmoney_min,
                'foodtype' => $foodtype,
            ], $expire);
        } else {
            // Clear cookies when remember is not set
            foreach (['remember', 'foodwhere_region', 'foodwhere_section', 'foodmoney_max', 'foodmoney_min', 'foodtype'] as $name) {
                $response->addCookie($name, '', time() - 3600);
            }
        }

        // Filter restaurants based on conditions
        $candidates = array_filter($this->restaurants, function ($res) use ($foodwhere_region, $foodwhere_section, $foodmoney_max, $foodmoney_min, $foodtype) {
            if ($foodwhere_region && $res['res_region'] != $foodwhere_region) return false;
            if ($foodwhere_section && $res['res_section'] != $foodwhere_section) return false;
            if ($foodmoney_max && $res['res_price'] > $foodmoney_max) return false;
            if ($foodmoney_min && $res['res_price'] < $foodmoney_min) return false;
            if ($foodtype && $res['res_foodtype'] != $foodtype) return false;
            return true;
        });

        $res_id = 0;
        if (count($candidates) > 0) {
            $res = $candidates[array_rand($candidates)];
            $res_id = $res['id'];
        }

        $response->setContent(json_encode(['status' => 'success', 'res_id' => $res_id]));
        return $response;
    }

    private function setRememberCookies(SimpleResponse $response, array $values, int $expire): void
    {
        foreach ($values as $name => $value) {
            $response->addCookie($name, (string)$value, $expire);
        }
    }

    /**
     * Captcha validation using session value.
     */
    public function checkCaptcha(SimpleRequest $request): SimpleResponse
    {
        $captcha = (string)$request->input('captcha', '');
        $sessionNumber = $request->session['check_number'] ?? null;
        $result = ($captcha !== '' && $captcha === $sessionNumber) ? 'success' : 'fail';
        return new SimpleResponse($result, 200, ['Content-Type' => 'text/html']);
    }

    /**
     * Store user feedback to a temporary JSON file.
     */
    public function saveFeedbackPost(SimpleRequest $request): SimpleResponse
    {
        $entry = [
            'f_name' => (string)$request->input('name', ''),
            'f_email' => (string)$request->input('email', ''),
            'f_content' => (string)$request->input('content', ''),
            'f_time' => time(),
        ];
        $file = sys_get_temp_dir() . '/feedback.json';
        $data = [];
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true) ?: [];
        }
        $data[] = $entry;
        $ok = file_put_contents($file, json_encode($data)) !== false;
        return new SimpleResponse($ok ? 'success' : 'fail', 200, ['Content-Type' => 'text/html']);
    }

    /**
     * Save blog information to a temporary JSON file.
     */
    public function blogSave(SimpleRequest $request): SimpleResponse
    {
        $entry = [
            'b_blogname' => (string)$request->input('res_blogname', ''),
            'b_bloglink' => (string)$request->input('res_bloglink', ''),
            'b_res_id' => (string)$request->input('res_id', ''),
        ];
        $file = sys_get_temp_dir() . '/blog.json';
        $data = [];
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true) ?: [];
        }
        $data[] = $entry;
        $ok = file_put_contents($file, json_encode($data)) !== false;
        $content = json_encode(['status' => $ok ? 'success' : 'fail']);
        return new SimpleResponse($content, 200, ['Content-Type' => 'application/json']);
    }
}

?>
