<?php

namespace Tests\Feature;

use PHPUnit\Framework\TestCase;
use App\Http\Controllers\AdminAjaxController;
use App\Models\Admin\Blog;
use App\Models\Admin\Restaurant;

class AdminAjaxControllerFeatureTest extends TestCase
{
    private AdminAjaxController $controller;

    protected function setUp(): void
    {
        parent::setUp();
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION = [];
        $this->controller = new AdminAjaxController();
    }

    public function testSaveResDataRequiresLogin(): void
    {
        $resp = $this->controller->saveResData([]);
        $data = json_decode($resp['body'], true);
        $this->assertEquals('unauthorized', $data['status']);
    }

    public function testSaveResDataCreatesRestaurant(): void
    {
        $_SESSION['id'] = 'admin';
        $resp = $this->controller->saveResData([
            'res_name' => 'foo',
            'res_area_num' => '1',
            'res_tel_num' => '123',
            'res_region' => 'region',
            'res_address' => 'addr',
            'res_foodtype' => 'type',
            'res_price' => '10',
            'open_time_hr' => '10',
            'open_time_min' => '00',
            'close_time_hr' => '20',
            'close_time_min' => '00',
            'res_note' => 'note',
        ]);
        $data = json_decode($resp['body'], true);
        $this->assertEquals('success', $data['status']);
        $this->assertCount(1, Restaurant::all());
    }

    public function testBlogActionsRequireLogin(): void
    {
        $resp = $this->controller->passBlog(['id' => 1]);
        $data = json_decode($resp['body'], true);
        $this->assertEquals('unauthorized', $data['status']);
    }

    public function testPassUnpassAndFixBlog(): void
    {
        $_SESSION['id'] = 'admin';
        // pass blog
        $this->controller->passBlog(['id' => 1]);
        $this->assertEquals('1', Blog::find(1)['b_blog_show']);
        // unpass blog
        $this->controller->unpassBlog(['id' => 1]);
        $this->assertEquals('0', Blog::find(1)['b_blog_show']);
        // fix blog
        $this->controller->fixBlog(['id' => 1, 'b_blogname' => 'new', 'b_bloglink' => 'url']);
        $blog = Blog::find(1);
        $this->assertEquals('new', $blog['b_blogname']);
        $this->assertEquals('url', $blog['b_bloglink']);
    }
}
