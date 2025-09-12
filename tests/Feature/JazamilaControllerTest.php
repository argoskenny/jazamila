<?php
namespace Tests\Feature;

use PHPUnit\Framework\TestCase;
use App\Http\Controllers\JazamilaController;

class JazamilaControllerTest extends TestCase
{
    private JazamilaController $controller;

    protected function setUp(): void
    {
        $this->controller = new JazamilaController();
    }

    public function testIndexUsesCookies(): void
    {
        $cookies = [
            'remember' => 1,
            'foodwhere_region' => 1,
            'foodmoney_max' => 200,
            'foodmoney_min' => 0,
            'foodtype' => 2,
        ];
        $data = $this->controller->index($cookies);
        $this->assertStringContainsString('checked', $data['remember_HTML']);
        $this->assertStringContainsString("value='1' selected='selected'", $data['foodwhere_region_HTML']);
        $this->assertStringContainsString("value='200' selected='selected'", $data['foodmoney_max_HTML']);
        $this->assertStringContainsString("value='2' selected='selected'", $data['foodtype_HTML']);
    }

    public function testListdataFiltersAndPaginates(): void
    {
        $data = $this->controller->listdata('1X0', 0, 0, 0, 1, []);
        $this->assertEquals(2, $data['current_num']);
        $this->assertCount(2, $data['restuarant']);
        $this->assertStringContainsString('<ul class="pagination">', $data['pages']);

        $search = $this->controller->listdata('0', 0, 0, 0, 1, ['search_keyword' => 'Sushi']);
        $this->assertEquals(1, $search['current_num']);
        $this->assertEquals('Sushi House', $search['restuarant'][0]['res_name']);
    }

    public function testDetailReturnsRestaurantAndBlog(): void
    {
        $cookies = ['remember' => 1, 'foodwhere_region' => 1, 'foodtype' => 1];
        $query = ['ul' => '0', 'ut' => '0', 'umx' => '0', 'umi' => '0', 'p' => '1'];
        $data = $this->controller->detail(1, $query, $cookies);
        $this->assertEquals(1, $data['res_data']['id']);
        $this->assertEquals('Sushi Blog', $data['blog'][0]['b_blogname']);
        $this->assertEquals('0/0/0/0/1', $data['list_record']);
        $this->assertEquals(1, $data['cookie_flag']);
    }

    public function testJsonApiHasFullImageUrl(): void
    {
        $data = $this->controller->jsonapi();
        $this->assertStringStartsWith('http://jazamila.com/assets/pics/', $data[0]['res_img_url']);
    }
}
