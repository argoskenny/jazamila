<?php
class Jazamila_ajax extends CI_Controller {
	
	// 建構子
	public function __construct()
	{
		parent::__construct();
		$this->load->model('random_model');
		
		// 引入SESSION
		$this->load->library('nativesession');
		
		// 引入COOKIE
		$this->load->helper('cookie');
	}
	
	// 隨機選餐廳
	function pick()
	{
		$foodwhere_region	= (int)$_POST['foodwhere_region'];
		$foodwhere_section	= (int)$_POST['foodwhere_section'];
		$foodmoney_max		= (int)$_POST['foodmoney_max'];
		$foodmoney_min		= (int)$_POST['foodmoney_min'];
		$foodtype	= (int)$_POST['foodtype'];
		$remember	= (int)$_POST['remember'];
		
		if($remember == 1)
		{
			$remember_COOKIE = array(
				'name'   => 'remember',
				'value'  => $remember,
				'expire' => 8650000,
				'secure' => FALSE
			);
			$this->input->set_cookie($remember_COOKIE);
			
			$foodwhere_region_COOKIE = array(
				'name'   => 'foodwhere_region',
				'value'  => $foodwhere_region,
				'expire' => 8650000,
				'secure' => FALSE
			);
			$this->input->set_cookie($foodwhere_region_COOKIE);
			
			$foodwhere_section_COOKIE = array(
				'name'   => 'foodwhere_section',
				'value'  => $foodwhere_section,
				'expire' => 8650000,
				'secure' => FALSE
			);
			$this->input->set_cookie($foodwhere_section_COOKIE);
			
			$foodmoney_max_COOKIE = array(
				'name'   => 'foodmoney_max',
				'value'  => $foodmoney_max,
				'expire' => 8650000,
				'secure' => FALSE
			);
			$this->input->set_cookie($foodmoney_max_COOKIE);
			
			$foodmoney_min_COOKIE = array(
				'name'   => 'foodmoney_min',
				'value'  => $foodmoney_min,
				'expire' => 8650000,
				'secure' => FALSE
			);
			$this->input->set_cookie($foodmoney_min_COOKIE);
			
			$foodtype_COOKIE = array(
				'name'   => 'foodtype',
				'value'  => $foodtype,
				'expire' => 8650000,
				'secure' => FALSE
			);
			$this->input->set_cookie($foodtype_COOKIE);
		}
		else
		{
			delete_cookie('remember');
			delete_cookie('foodwhere_region');
			delete_cookie('foodwhere_section');
			delete_cookie('foodmoney_max');
			delete_cookie('foodmoney_min');
			delete_cookie('foodtype');
		}
		
		$where_arr = array();
		$keyword = '';
		$where_flag = false;
		
		// 餐廳地區
		if( !empty($foodwhere_region) )
		{
			$where_arr['res_region'] = $foodwhere_region;
			$where_flag = true;
		}
		
		if( !empty($foodwhere_section) )
		{
			$where_arr['res_section'] = $foodwhere_section;
			$where_flag = true;
		}
		
		// 餐廳價位
		if($foodmoney_max != 0)
		{
			$where_arr['res_price <='] = $foodmoney_max;
			$where_flag = true;
		}
		if($foodmoney_min != 0)
		{
			$where_arr['res_price >='] = $foodmoney_min;
			$where_flag = true;
		}
		
		// 美食類型
		if($foodtype != 0)
		{
			$where_arr['res_foodtype'] = $foodtype;
			$where_flag = true;
		}
		
		// 依條件計算所有筆數 (日後使用排程優化)
		if($where_flag == true)
		{
			$max_num = $this->random_model->all_where_restaurant($where_arr,$keyword);
		}
		else
		{
			$max_num = $this->random_model->all_restaurant();
		}
		
		$max_num = $max_num-1;	
		$limit = ($max_num == 0) ? 0 : rand(1,$max_num);
		$res_data = $this->random_model->random_show_restaurant($where_arr,$limit);
		if(!empty($res_data))
		{
			$res_id = $res_data[0]['id'];
			echo json_encode(array("status"=>"success","res_id"=>$res_id));
		}
		else
		{
			echo json_encode(array("status"=>"success","res_id"=> 0 ));
		}
	}
	
	// 回覆資料儲存
	function save_feedback_post()
	{
		$set_data = array(
			'f_name'		=> $_POST['name'],
			'f_email'		=> $_POST['email'],
			'f_content'		=> $_POST['content'],
			'f_time'		=> time()
		);
		if($this->random_model->save_feedback($set_data))
		{
			echo 'success';
		}
		else
		{
			echo 'fail';
		}
	}
	
	// 食記資料儲存
	function blog_save()
	{
		$set_data = array(
			'b_blogname'	=> $_POST['res_blogname'],
			'b_bloglink'	=> $_POST['res_bloglink'],
			'b_res_id'		=> $_POST['res_id']
		);
		if( $this->random_model->save_blog($set_data) )
		{
			echo json_encode(array("status"=>"success"));
		}
		else
		{
			echo json_encode(array("status"=>"fail"));
		}
	}
	
	// 提供地區option
	function get_section()
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/area.inc.php');

		$r_id = $_POST['regionid'];
		$HTML = '';

		foreach( $Area_rel[$r_id] as $key => $val )
		{
			$HTML .= '<option value="'.$val.'" >'.$Sectionid[$val].'</option>';
		}

		echo $HTML;
	}
	
	// 提供地區option 依照COOKIE設定
	function get_section_cookie()
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/area.inc.php');

		$r_id = $_POST['regionid'];
		$HTML = '';
		
		$foodwhere_section_COOKIE = $this->input->cookie('foodwhere_section');
		$foodwhere_section_COOKIE = ( !empty($foodwhere_section_COOKIE) ) ? $foodwhere_section_COOKIE : 0;
		
		foreach( $Area_rel[$r_id] as $key => $val )
		{
			if($foodwhere_section_COOKIE == $val)
			{
				$HTML .= '<option value="'.$val.'"  selected="selected">'.$Sectionid[$val].'</option>';
			}
			else
			{
				$HTML .= '<option value="'.$val.'" >'.$Sectionid[$val].'</option>';
			}
		}

		echo $HTML;
	}
	
	// 提供地區option 餐廳列表使用
	function listdata_get_section()
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/area.inc.php');

		$r_id = $_POST['regionid'];
		$HTML = '<li><a href="javascript:void(0);" onclick="section_click(\'0\',\'全區\');">全區</a></li>';
		foreach( $Area_rel[$r_id] as $key => $val )
		{
			$HTML .= '<li><a href="javascript:void(0);" onclick="section_click(\''.$val.'\',\''.$Sectionid[$val].'\');">'.$Sectionid[$val].'</a></li>';
		}

		echo $HTML;
	}
	
	// 驗證碼檢查
	function check_captcha()
	{
		if($this->nativesession->get('check_number') == $_POST['captcha'])
		{
			echo 'success';
		}
		else
		{
			echo 'fail';
		}
	}
}
?>