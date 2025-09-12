<?php

namespace Tests\Feature;

use PHPUnit\Framework\TestCase;
use App\Http\Controllers\JazamilaAjaxController;
use Illuminate\Http\Request;
use Illuminate\Session\Store;
use Symfony\Component\HttpFoundation\Session\Storage\Handler\ArraySessionHandler;

class JazamilaAjaxControllerTest extends TestCase
{
    private JazamilaAjaxController $controller;

    protected function setUp(): void
    {
        $this->controller = new JazamilaAjaxController();
    }

    public function testPickSetsCookies(): void
    {
        $request = Request::create('/jazamila_ajax/pick', 'POST', [
            'foodwhere_region' => 1,
            'foodwhere_section' => 2,
            'foodmoney_max' => 100,
            'foodmoney_min' => 0,
            'foodtype' => 1,
            'remember' => 1,
        ]);

        $response = $this->controller->pick($request);

        $this->assertSame('application/json', $response->headers->get('Content-Type'));
        $data = json_decode($response->getContent(), true);
        $this->assertEquals('success', $data['status']);
        $this->assertEquals(1, $data['res_id']);

        $cookies = $response->headers->getCookies();
        $this->assertNotEmpty(array_filter($cookies, fn ($c) => $c->getName() === 'remember'));
    }

    public function testCheckCaptcha(): void
    {
        $request = Request::create('/jazamila_ajax/check_captcha', 'POST', ['captcha' => '1234']);
        $session = new Store('test', new ArraySessionHandler());
        $request->setLaravelSession($session);
        $session->put('check_number', '1234');

        $response = $this->controller->checkCaptcha($request);
        $this->assertSame('text/html', $response->headers->get('Content-Type'));
        $this->assertSame('success', $response->getContent());
    }

    public function testGetSectionCookie(): void
    {
        $request = Request::create('/jazamila_ajax/get_section_cookie', 'POST', ['regionid' => 1], ['foodwhere_section' => 3]);
        $response = $this->controller->getSectionCookie($request);
        $this->assertStringContainsString('selected="selected"', $response->getContent());
    }

    public function testListdataGetSection(): void
    {
        $request = Request::create('/jazamila_ajax/listdata_get_section', 'POST', ['regionid' => 1]);
        $response = $this->controller->listdataGetSection($request);
        $html = $response->getContent();
        $this->assertStringContainsString("section_click('0','全區')", $html);
        $this->assertStringContainsString("section_click('2','大同區')", $html);
    }

    public function testSaveFeedbackAndBlogSave(): void
    {
        $feedbackRequest = Request::create('/jazamila_ajax/save_feedback_post', 'POST', [
            'name' => 'John',
            'email' => 'john@example.com',
            'content' => 'Hello',
        ]);
        $feedbackResponse = $this->controller->saveFeedbackPost($feedbackRequest);
        $this->assertSame('success', $feedbackResponse->getContent());

        $blogRequest = Request::create('/jazamila_ajax/blog_save', 'POST', [
            'res_blogname' => 'Blog',
            'res_bloglink' => 'http://example.com',
            'res_id' => '1',
        ]);
        $blogResponse = $this->controller->blogSave($blogRequest);
        $data = json_decode($blogResponse->getContent(), true);
        $this->assertEquals('success', $data['status']);
    }
}

