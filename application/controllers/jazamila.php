<?php
class Jazamila extends CI_Controller {
	
	// 建構子
	public function __construct()
	{
		parent::__construct();
		$this->load->model('random_model');
		
		// 引入連結
		$this->load->helper('url');
		
		// 引入SESSION
		$this->load->library('nativesession');
		
		// 引入COOKIE
		$this->load->helper('cookie');
	}
	
	// 首頁
	public function index()
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		require(APPPATH .'rf_config/area.inc.php');
		
		// COOKIE條件選單 必須擺在程式最前面
		$data = $this->cookie_option();
		
		$data['config']['regionid'] = $Regionid;
		$data['config']['foodtype'] = $Foodtype;
		
		$data['title']				= 'JAZAMILA';
		$this->load->view('jazamila/index',$data);
	}
	
	// 列表
	public function listdata($url_location,$url_type,$url_maxmoney,$url_minmoney,$page)
	{
		// 檢驗網址自帶變數
		$this->check_segment($url_type);
		$this->check_segment($url_maxmoney);
		$this->check_segment($url_minmoney);
		$this->check_segment($page);
		
		$where_arr	= array();
		$main_text 	= array();
		$url_region = 0;
		$url_section = 0;
		$keyword 	= '';
		$sufix_q	= '';
		
		// 關鍵字處理
		if(!empty($_GET['search_keyword']))
		{
			$keyword = $_GET['search_keyword'];
			$search_keyword_value = $_GET['search_keyword'];
			$keyword_pagelink = '?search_keyword='.$_GET['search_keyword'];
			$sufix_q = '?';
		}
		else
		{
			$keyword_pagelink = '';
			$search_keyword_value = '請輸入關鍵字';
		}
		
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		require(APPPATH .'rf_config/area.inc.php');
		
		// 條件處理
		if($url_location != 0)
		{
			$url_location_arr	= explode("X",$url_location);
			$url_region			= $url_location_arr[0];
			$url_section		= $url_location_arr[1];
			
			$where_arr['res_region'] = $url_region;
			
			if($url_section != 0)
			{
				$where_arr['res_section'] = $url_section;
			}
		}
		if($url_type != 0)
		{
			$where_arr['res_foodtype'] = $url_type;
		}
		if($url_maxmoney != 0)
		{
			$where_arr['res_price <='] = $url_maxmoney;
		}
		if($url_minmoney != 0)
		{
			$where_arr['res_price >='] = $url_minmoney;
		}
		
		// 副標處理
		if($url_location == 0 && $url_type == 0 && $url_maxmoney == 0 && $url_minmoney == 0 && $keyword == '')
		{
			$main_text[] = '所有';
		}
		else
		{
			if($url_location != 0)
			{
				$location_text = '地點為'.$Regionid[$url_region];
				if($url_section != 0)
				{
					$location_text .= $Sectionid[$url_section];
				}
				
				$main_text[] = $location_text;
			}
			if($url_type != 0)
			{
				$main_text[] = '美食類型為'.$Foodtype[$url_type];
			}
			if($url_maxmoney != 0 || $url_minmoney != 0)
			{
				$maxmoney_str	= ($url_maxmoney == 0) ? '無上限' : $url_maxmoney.'元';
				$main_text[]	= '平均價位由'.$url_minmoney.'元至'.$maxmoney_str;
			}
			if($keyword != '')
			{
				$main_text[] = '關鍵字為'.$keyword;
			}
		}
		$data['main_text'] = implode('，',$main_text).'的餐廳';
		
		// 分頁
		$this->load->library('pagination');
		$config['base_url'] 		= base_url().'listdata/'.$url_location.'/'.$url_type.'/'.$url_maxmoney.'/'.$url_minmoney.'/'; // 設定頁面輸出網址
		
		$config['first_url']		= 'listdata/'.$url_location.'/'.$url_type.'/'.$url_maxmoney.'/'.$url_minmoney.'/1'.$keyword_pagelink;
		$config['suffix'] 			= $sufix_q.http_build_query($_GET, '', '&');
		$config['total_rows']		= $this->random_model->all_where_restaurant($where_arr,$keyword); // 計算所有筆數
		$config['per_page']			= '10'; // 一個分頁的數量
		$config["uri_segment"]		= 6;
		$config['num_links']		= 2;
		$config['use_page_numbers']	= TRUE;
		
		// 以下是設定樣式
		$config['full_tag_open']	= '<ul class="pagination">';
		$config['full_tag_close']	= '</ul>';
		$config['cur_tag_open']		= '<li class="active"><span>';
		$config['cur_tag_close']	= '<span class="sr-only">(current)</span></span>';
		$config['num_tag_open']		= '<li>';
		$config['num_tag_close']	= '</li>';
		
		$config['first_link']		= '&laquo;';
		$config['first_tag_open']	= '<li>';
		$config['first_tag_close']	= '</li>';
		$config['last_link']		= '&raquo;';
		$config['last_tag_open']	= '<li>';
		$config['last_tag_close']	= '</li>';
		
		$config['prev_link']		= '&lsaquo;';
		$config['prev_tag_open']	= '<li>';
		$config['prev_tag_close']	= '</li>';
		$config['next_link']		= '&rsaquo;';
		$config['next_tag_open']	= '<li>';
		$config['next_tag_close']	= '</li>';
		
		$this->pagination->initialize($config);
		$data['pages']	= $this->pagination->create_links();
		
		// 存取餐廳資料
		$data['restuarant'] = $this->random_model->show_restaurant_list($page,$where_arr,$keyword);
		
		// 美食類型傳遞
		$data['config']['foodtype'] = $Foodtype;
		$data['config']['region']	= $Regionid;
		$data['config']['section']	= $Sectionid;
		
		// 列表條件傳遞
		$data['url_region'] 	= $url_region;
		$data['url_section'] 	= $url_section;
		$data['url_type'] 		= $url_type;
		$data['url_maxmoney'] 	= $url_maxmoney;
		$data['url_minmoney'] 	= $url_minmoney;
		$data['url_page'] 		= $page;
		
		// 詳細內容帶入紀錄列表條件
		$currentPage = $this->uri->segment(6); // 目前頁面
		$data['list_record']	= '?ul='.$url_location.'&ut='.$url_type.'&umx='.$url_maxmoney.'&umi='.$url_minmoney.'&p='.$currentPage;
		
		$data['current_num']	= $config['total_rows'];
		
		$data['search_keyword_value'] = $search_keyword_value;
		$data['title'] 	= 'JAZAMILA - 餐廳列表';
		$this->load->view('jazamila/listdata',$data);
	}
	
	// 詳細
	public function detail($res_id)
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		require(APPPATH .'rf_config/area.inc.php');
		
		// 載入推薦餐廳
		require(APPPATH .'rf_config/recommend.inc.php');
		
		// 優先使用COOKIE 必須擺在程式最前面
		$remember_COOKIE = $this->input->cookie('remember');
		$get_arr = array();
		if( !empty($_GET['option']) )
		{
			$get_arr = explode('XX',$_GET['option']);
		}
		$get_where_region = ( !empty($get_arr[0]) ) ? $get_arr[0] : 1;
		$get_where_section = ( !empty($get_arr[1]) ) ? $get_arr[1] : 0;
		$get_max = ( !empty($get_arr[2]) ) ? $get_arr[2] : 0;
		$get_min = ( !empty($get_arr[3]) ) ? $get_arr[3] : 0;
		$get_t = ( !empty($get_arr[4]) ) ? $get_arr[4] : 0;
		
		// 檢驗網址自帶變數
		$this->check_segment($get_where_region);
		$this->check_segment($get_where_section);
		$this->check_segment($get_max);
		$this->check_segment($get_min);
		$this->check_segment($get_t);
		
		
		// 檢驗網址自帶變數
		$this->check_segment($res_id);
		
		if($remember_COOKIE == 1)
		{
			$data = $this->cookie_option();
			$data['cookie_flag'] = 1;
		}
		else
		{
			// 記得我選項
			$data['remember_HTML'] = '<input type="checkbox" id="remember_box" name="remember_box">';
			
			// 地點選單
			$data['foodwhere_region_HTML'] = '';
			foreach($Regionid as $key => $val)
			{
				if($get_where_region == $key)
				{
					$data['foodwhere_region_HTML'] .= "<option value='".$key."' selected='selected'>".$val."</option>";
				}
				else
				{
					$data['foodwhere_region_HTML'] .= "<option value='".$key."'>".$val."</option>";
				}
			}
			
			// 地區選單
			$data['foodwhere_section_HTML'] = '<option value="0">全區</option>';
			foreach( $Area_rel[$get_where_region] as $key => $val )
			{
				if($get_where_section == $val)
				{
					$data['foodwhere_section_HTML'] .= "<option value='".$val."' selected='selected'>".$Sectionid[$val]."</option>";
				}
				else
				{
					$data['foodwhere_section_HTML'] .= "<option value='".$val."'>".$Sectionid[$val]."</option>";
				}
			}
			
			// 均價選單
			$data['foodmoney_max_HTML'] = '<option value="0">都可以</option>';
			for($money = 1; $money < 11; $money++)
			{
				if($get_max == ((int)$money*100))
				{
					$data['foodmoney_max_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
				}
				else
				{
					$data['foodmoney_max_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
				}
			}
			
			$data['foodmoney_min_HTML'] = '<option value="0">0元</option>';
			for($money = 1; $money < 11; $money++)
			{
				if($get_min == ((int)$money*100))
				{
					$data['foodmoney_min_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
				}
				else
				{
					$data['foodmoney_min_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
				}
			}
			
			// 類型選單
			$data['foodtype_HTML'] = '<option value="0">都可以</option>';
			foreach($Foodtype as $key => $val){
				if($get_t == $key)
				{
					$data['foodtype_HTML'] .= "<option value='".$key."' selected='selected'>".$val."</option>";
				}
				else
				{
					$data['foodtype_HTML'] .= "<option value='".$key."'>".$val."</option>";
				}
			}
			
			$data['cookie_flag'] = 0;
		}
		
		// 餐廳資料
		$data['restuarant'] = $this->random_model->show_restaurant($res_id);
		if( empty($data['restuarant']) )
		{
			header('Location:'.base_url());
			exit;
		}
		
		// 餐廳簡介
		if(!empty($data['restuarant'][0]['res_note']))
		{
			$data['restuarant'][0]['res_note'] = '<div class="describe_info">'.$data['restuarant'][0]['res_note'].'</div>';
		}
		
		// 食記資料
		$data['blog'] = $this->random_model->show_blog($res_id);
		
		// 隨機挑選推薦餐廳
		shuffle($Recommend);
		$rec_count = 1;
		foreach($Recommend as $key => $val)
		{
			if($rec_count < 5)
			{
				$data['recommend_res'.$rec_count] = $this->random_model->show_restaurant($val);
				$rec_count++;
			}
		}
		
		// 列表條件紀錄之連結
		$url_location	= ( !empty($_GET['ul']) )	? $_GET['ul']	: 0;
		$url_maxmoney	= ( !empty($_GET['umx']) )	? $_GET['umx']	: 0;
		$url_minmoney	= ( !empty($_GET['umi']) )	? $_GET['umi']	: 0;
		$url_type		= ( !empty($_GET['ut']) )	? $_GET['ut']	: 0;
		$currentPage	= ( !empty($_GET['p']) )	? $_GET['p']	: 1;
		
		$data['list_record']	= $url_location.'/'.$url_type.'/'.$url_maxmoney.'/'.$url_minmoney.'/'.$currentPage;
		
		$data['title'] 	= 'JAZAMILA - 餐廳詳細資料';
		$this->load->view('jazamila/detail',$data);
	}
	
	// 地圖
	public function map()
	{
		$data['title'] 	= 'JAZAMILA - 美食地圖';
		$this->load->view('jazamila/map',$data);
	}
	
	// 關於
	public function about()
	{
		$data['title'] 	= 'JAZAMILA - 關於本站';
		$this->load->view('jazamila/about',$data);
	}
	
	// 新增餐廳
	public function post()
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		require(APPPATH .'rf_config/area.inc.php');
		
		$data['save'] = 0;
		if( !empty($_GET['save']) && $_GET['save'] == 'ok' )
		{
			$data['save'] = 1;
		}
		
		$data['config']['regionid'] = $Regionid;
		$data['config']['foodtype'] = $Foodtype;
		
		$data['title'] 	= 'JAZAMILA - 新增餐廳';
		$this->load->view('jazamila/post',$data);
	}
	
	// 儲存新增餐廳
	public function save_post_data()
	{
		$this->load->library('recaptcha');

		// Register API keys at https://www.google.com/recaptcha/admin
		$siteKey = "6LdH9gATAAAAAIGxel7yPewJbIhC5xwUA0ZUJAgz";
		$secret = "6LdH9gATAAAAALcTCdsNj_iBplsuWEZZWWKJ_yQH";
		// reCAPTCHA supported 40+ languages listed here: https://developers.google.com/recaptcha/docs/language
		$lang = "zh-TW";
		// The response from reCAPTCHA
		$resp = null;
		// The error code from reCAPTCHA, if any
		$error = null;
		$this->recaptcha->ReCaptcha();
		// Was there a reCAPTCHA response?
		if ($_POST["g-recaptcha-response"]) {
		    $resp = $this->recaptcha->verifyResponse(
		        $_SERVER["REMOTE_ADDR"],
		        $_POST["g-recaptcha-response"]
		    );
		}

		if ($resp != null && $resp->success) {

		}
		else
		{
			header('Location:http://jazamila.com/post?cpatcha=wrong');
			exit;
		}

		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		require(APPPATH .'rf_config/area.inc.php');
		
		// 資料處理
		$open_Time		= (!empty($_POST['open_time_hr']) && !empty($_POST['open_time_min'])) ? strtotime($_POST['open_time_hr'].':'.$_POST['open_time_min'].':00') : '';
		$close_Time		= (!empty($_POST['close_time_hr']) && !empty($_POST['close_time_min'])) ?strtotime($_POST['close_time_hr'].':'.$_POST['close_time_min'].':00') : '';
		$res_Area_num	= str_pad($_POST['res_area_num'], 2, '0', STR_PAD_LEFT);
		$res_Note		= ($_POST['res_note']) ? nl2br($_POST['res_note']) : '';
		
		// 照片處理
		$resize_Img = "";
		$resize_ori_Img = "";
		if( !empty($_FILES['img_url']) )
		{
			if ($_FILES['img_url']['error'] > 0)
			{
				$upload_Error = $_FILES['img_url']['error'];
			}
			else
			{
				$tmp_file		= 'assets/tmp/'.$_FILES['img_url']['name'];
				$img_type		= explode(".",$_FILES["img_url"]["name"]);
				$resize_Img 	= 'preview_'.time().'.'.$img_type[1];
				$rezsize_path	= 'assets/post/'.$resize_Img;
				move_uploaded_file($_FILES['img_url']['tmp_name'],$tmp_file);
				
				$config['image_library']	= 'gd2';
				$config['source_image']		= $tmp_file;
				$config['new_image']		= $rezsize_path;
				$config['maintain_ratio']	= TRUE;
				$config['width']			= 375;
				$config['height']			= 500;
				
				$this->load->library('image_lib'); // 圖像處理類別
				$this->image_lib->initialize($config); 
				$this->image_lib->resize();
				
				$resize_ori_Img = "";
			}
		}
		
		// 將取得資料轉為陣列
		$set_data = array(
			'post_name'			=> $_POST['res_name'],
			'post_area_num'		=> $res_Area_num,
			'post_tel_num'		=> $_POST['res_tel_num'],
			'post_region'		=> $_POST['res_region'],
			'post_section'		=> $_POST['res_section'],
			'post_address'		=> $_POST['res_address'],
			'post_foodtype'		=> $_POST['res_foodtype'],
			'post_price'		=> $_POST['res_price'],
			'post_open_time'	=> $open_Time,
			'post_close_time'	=> $close_Time,
			'post_note'			=> $res_Note,
			'post_updatetime'	=> time()
		);
		if( !empty($resize_Img) )
		{
			$set_data['post_img_url']		= $resize_Img;
			$set_data['post_img_ori_url']	= $resize_ori_Img;
		}
		
		$insert_id = $this->random_model->save_post($set_data);
		$save_status = true;
		
		// 食記連結
		for( $i = 1; $i < 5; $i++ )
		{
			if( !empty($_POST['res_bloglink'.$i]) )
			{
				// 食記名稱
				$blog_tmp_name = ( !empty($_POST['res_blogname'.$i]) ) ? $_POST['res_blogname'.$i] : $_POST['res_name']."食記 - ".$i;
				
				// 食記資料
				$blog_data = array(
					'b_blogname'	=> $blog_tmp_name,
					'b_bloglink'	=> $_POST['res_bloglink'.$i],
					'b_blogno'		=> $i,
					'b_post_id'		=> $insert_id
				);
				
				$this->random_model->save_blog($blog_data);
			}
		}
		
		if($save_status)
		{
			header('Location:'.base_url().'/post?save=ok');
		}
		else
		{
			header('Location:'.base_url().'/post?save=fail');
		}
	}

	// API 使用
	public function jsonapi()
	{
		$url = "http://jazamila.com/assets/pics/";
		$data = $this->random_model->api_all_list();
		$json = $data;
		foreach ($data as $key => $value) {
			$json[$key]['res_img_url'] = $url.$value['res_img_url'];
		}
		echo json_encode($json);
	}
	
	// 圖片驗證
	public function CaptchaImg()
	{
		$im = imagecreate(60, 30);
		
		// 橘底白字
		$bg = imagecolorallocate($im, 249, 112, 92);
		$textcolor = imagecolorallocate($im, 255, 255, 255);
		
		// 初始化驗證碼
		$text="";

		// 創建一個隨機函數包所需要的範圍
		$textAll = array_merge_recursive(range('A','Z'),range('a','z'),range('0','9'));

		$length = 4;
		for($i = 1; $i <= $length;)
		{
			 // 隨機取出一位數。
			 $ai = rand(0,61);
			 $val = $textAll[$ai];
			 if(($val != 'O') && ($val != 'o') && ($val != '0'))
			 {
				 $text.=$textAll[$ai];
				 $i++;
			 }
		}

		// 記入SESSION 驗證使用
		$this->nativesession->set('check_number',$text);
		
		// 寫入圖片
		imagestring($im, 6, 14, 8, $text, $textcolor);

		// 輸出圖片
		header('Content-type: image/png');
		imagepng($im);
		imagedestroy($im);
	}
	
	// 條件選單 COOKIE判斷
	function cookie_option()
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		require(APPPATH .'rf_config/area.inc.php');
		
		// 讀入COOKIE
		$foodwhere_region_COOKIE = $this->input->cookie('foodwhere_region');
		$foodwhere_section_COOKIE = $this->input->cookie('foodwhere_section');
		$foodmoney_max_COOKIE = $this->input->cookie('foodmoney_max');
		$foodmoney_min_COOKIE = $this->input->cookie('foodmoney_min');
		$foodtype_COOKIE = $this->input->cookie('foodtype');
		$remember_COOKIE = $this->input->cookie('remember');
		$foodwhere_region_COOKIE = ( !empty($foodwhere_region_COOKIE) ) ? $foodwhere_region_COOKIE : 0;
		$foodwhere_section_COOKIE = ( !empty($foodwhere_section_COOKIE) ) ? $foodwhere_section_COOKIE : 0;
		$foodmoney_max_COOKIE = ( !empty($foodmoney_max_COOKIE) ) ? $foodmoney_max_COOKIE : 0;
		$foodmoney_min_COOKIE = ( !empty($foodmoney_min_COOKIE) ) ? $foodmoney_min_COOKIE : 0;
		$foodtype_COOKIE = ( !empty($foodtype_COOKIE) ) ? $foodtype_COOKIE : 0;
		
		// 記得我所選checkbox
		$remember_HTML = ( !empty($remember_COOKIE) ) ? '<input type="checkbox" id="remember_box" name="remember_box" checked="checked">' : '<input type="checkbox" id="remember_box" name="remember_box">';
		
		// 地點選單
		$foodwhere_region_HTML = '';
		foreach($Regionid as $key => $val)
		{
			if($foodwhere_region_COOKIE == $key)
			{
				$foodwhere_region_HTML .= "<option value='".$key."' selected='selected'>".$val."</option>";
			}
			else
			{
				$foodwhere_region_HTML .= "<option value='".$key."'>".$val."</option>";
			}
		}
		
		// 均價選單
		$foodmoney_min_HTML = '';
		for($money = 0; $money < 12; $money++)
		{
			$show_money = (int)$money*100;
			if($show_money == 0)
			{
				$show_money_str = '0元';
			}
			elseif($show_money == 1100)
			{
				$show_money_str = '1000元以上';
			}
			else
			{
				$show_money_str = $show_money.'元左右';
			}
			
			if($foodmoney_min_COOKIE == $show_money)
			{
				$foodmoney_min_HTML .= "<option value='".$show_money."' selected='selected'>".$show_money_str."</option>";
			}
			else
			{
				$foodmoney_min_HTML .= "<option value='".$show_money."'>".$show_money_str."</option>";
			}
		}
		
		$foodmoney_max_HTML = '';
		for($money = 0; $money < 12; $money++)
		{
			$show_money = (int)$money*100;
			if($show_money == 0)
			{
				$show_money_str = '都可以';
			}
			elseif($show_money == 1100)
			{
				$show_money_str = '1000元以上';
			}
			else
			{
				$show_money_str = $show_money.'元左右';
			}
			
			if($foodmoney_max_COOKIE == $show_money)
			{
				$foodmoney_max_HTML .= "<option value='".$show_money."' selected='selected'>".$show_money_str."</option>";
			}
			else
			{
				$foodmoney_max_HTML .= "<option value='".$show_money."'>".$show_money_str."</option>";
			}
		}
		
		// 類型選單
		$foodtype_HTML = '<option value="0">都可以</option>';
		foreach($Foodtype as $key => $val)
		{
			if($foodtype_COOKIE == $key)
			{
				$foodtype_HTML .= "<option value='".$key."' selected='selected'>".$val."</option>";
			}
			else
			{
				$foodtype_HTML .= "<option value='".$key."'>".$val."</option>";
			}
		}
		
		$data['remember_HTML']		= $remember_HTML;
		$data['foodwhere_region_HTML']	= $foodwhere_region_HTML;
		$data['foodmoney_max_HTML']	= $foodmoney_max_HTML;
		$data['foodmoney_min_HTML']	= $foodmoney_min_HTML;
		$data['foodtype_HTML']		= $foodtype_HTML;
		
		return $data;
	}
	
	// 檢查網址自帶變數是否為數字
	function check_segment($var)
	{
		if(is_numeric($var) == false)
		{
			header('Location:'.base_url());
			exit;
		}
		else
		{
			return true;
		}
	}
}