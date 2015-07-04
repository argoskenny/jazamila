<?php
class Admin extends CI_Controller {
	
	// 建構子
	public function __construct()
	{
		parent::__construct();
		$this->load->model('random_model');
		
		// 引入連結
		$this->load->helper('url');
		
		// 引入SESSION
		$this->load->library('nativesession');
		
		// 資料庫讀取
		$this->load->database();
	}
	
	// 後台首頁
	public function index()
	{
		require(APPPATH .'rf_config/admin.inc.php');
		if(array_key_exists($this->nativesession->get('id'),$admin_list) == true)
		{	
			$data['title'] 				= '後台首頁';
			$data['detail_title_eng'] 	= 'Admin Panel';
			$this->load->view('admin/index', $data);
		}
		else
		{
			$this->login();
		}
	}
	
	// 後台登入
	public function login()
	{
		$data['title'] 				= '登入';
		$data['detail_title_eng'] 	= 'Login';
		
		$this->load->view('admin/login',$data);
	}
	
	// 餐廳列表
	public function res_list($set)
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		$where_arr = array();
		$keyword = '';
		$get_max = '';
		$get_min = '';
		$get_type = '';
		
		// 關鍵字處理
		if(!empty($_GET['search_keyword']))
		{
			$keyword = $_GET['search_keyword'];
			$search_keyword_value = $_GET['search_keyword'];
		}
		else
		{
			$search_keyword_value = '';
		}
		
		// 條件處理
		if( !empty($_GET['url_maxmoney']) )
		{
			if( $_GET['url_maxmoney'] != 0 )
			{
				$where_arr['res_price <='] = $_GET['url_maxmoney'];
				$get_max = $_GET['url_maxmoney'];
			}
		}
		if( !empty($_GET['url_minmoney']) )
		{
			if( $_GET['url_minmoney'] != 0 )
			{
				$where_arr['res_price >='] = $_GET['url_minmoney'];
				$get_min = $_GET['url_minmoney'];
			}
		}
		if( !empty($_GET['url_foodtype']) )
		{
			if( $_GET['url_foodtype'] != 0 )
			{
				$where_arr['res_foodtype'] = $_GET['url_foodtype'];
				$get_type = $_GET['url_foodtype'];
			}
		}
		
		$sufix_q = ( empty($_GET) ) ? '' : '?';
		
		// 最大金額選單
		$data['url_maxmoney_HTML'] = '<option value="0">0元</option>';
		for($money = 1; $money < 11; $money++)
		{
			if($get_max == ((int)$money*100))
			{
				$data['url_maxmoney_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
			}
			else
			{
				$data['url_maxmoney_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
			}
		}
		
		// 最小金額選單
		$data['url_minmoney_HTML'] = '<option value="0">0元</option>';
		for($money = 1; $money < 11; $money++)
		{
			if($get_min == ((int)$money*100))
			{
				$data['url_minmoney_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
			}
			else
			{
				$data['url_minmoney_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
			}
		}
		
		// 類型選單
		$data['res_foodtype_HTML'] = '<option value="0">都可以</option>';
		foreach($Foodtype as $key => $val){
			if($get_type == $key)
			{
				$data['res_foodtype_HTML'] .= "<option value='".$key."' selected='selected'>".$val."</option>";
			}
			else
			{
				$data['res_foodtype_HTML'] .= "<option value='".$key."'>".$val."</option>";
			}
		}
		
		// 關鍵字紀錄
		$data['search_keyword_value'] = $search_keyword_value;
		
		$this->login_check();
		$this->load->library('pagination');
		
		// 分頁設定樣式
		$config = $this->pagenation_style();
		
		// 分頁
		$config['base_url']		= base_url().'admin/res_list/';//設定頁面輸出網址
		$config['first_url']	= 'admin/res_list/1'.$sufix_q.http_build_query($_GET, '', '&');
		$config['suffix']		= $sufix_q.http_build_query($_GET, '', '&');
		$config['total_rows']	= $this->random_model->all_where_restaurant($where_arr,$keyword); //計算所有筆數
		$config['per_page']		= '10'; //一個分頁的數量
		
		$config['num_links']	= 3;
		
		$this->pagination->initialize($config);
		$data['pages']	= $this->pagination->create_links();
		
		$data['list_record'] = $set;
		
		// 存取餐廳資料
		$data['restuarant'] = $this->random_model->show_restaurant_list($set,$where_arr,$keyword);
		
		$data['title'] 				= '餐廳列表';
		$data['detail_title_eng'] 	= 'Restaurant List';
		
		$this->load->view('admin/res_list', $data);
	}
	
	// 餐廳詳細資料
	public function res_detail($res_id)
	{
		$this->login_check();
		// 頁數紀錄
		$list_record = (!empty($_GET['p'])) ? $_GET['p'] : '';
		$data['list_record']		= $list_record;
		
		$data['restuarant'] = $this->random_model->show_restaurant($res_id);
		
		$data['title'] 				= '餐廳詳細資料';
		$data['detail_title_eng'] 	= 'Restaurant Detail';
		
		$this->load->view('admin/res_detail', $data);
	}
	
	// 新增餐廳
	public function res_insert()
	{
		$this->login_check();
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/area.inc.php');
		require(APPPATH .'rf_config/type.inc.php');
		
		$data['config']['regionid'] = $Regionid;
		$data['config']['foodtype'] = $Foodtype;
		$data['title'] 				= '新增餐廳資料';
		$data['detail_title_eng'] 	= 'Add New Restaurant';
		
		$this->load->view('admin/res_insert', $data);
	}
	
	// 編輯餐廳
	public function res_edit($res_id)
	{
		$this->login_check();
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/area.inc.php');
		require(APPPATH .'rf_config/type.inc.php');
		
		// 頁數紀錄
		$list_record = (!empty($_GET['p'])) ? $_GET['p'] : '';
		$data['list_record']		= $list_record;
		
		$data['restuarant'] = $this->random_model->show_restaurant($res_id);
		
		$data['config']['regionid'] = $Regionid;
		$data['config']['sectionid'] = $Sectionid;
		$data['config']['foodtype'] = $Foodtype;
		$data['title'] 				= '編輯餐廳資料';
		$data['detail_title_eng'] 	= 'Restaurant Edit';
		
		$this->load->view('admin/res_edit', $data);
	}
	
	// 儲存餐廳資料
	public function save_res_data()
	{
		// 資料處理
		$open_Time		= (!empty($_POST['open_time_hr']) && !empty($_POST['open_time_min'])) ? strtotime($_POST['open_time_hr'].':'.$_POST['open_time_min'].':00') : '';
		$close_Time		= (!empty($_POST['close_time_hr']) && !empty($_POST['close_time_min'])) ?strtotime($_POST['close_time_hr'].':'.$_POST['close_time_min'].':00') : '';
		$res_Area_num	= str_pad($_POST['res_area_num'], 2, '0', STR_PAD_LEFT);
		$res_Note		= ($_POST['res_note']) ? nl2br($_POST['res_note']) : '';
		$id				= ($_POST['edit_id']) ? $_POST['edit_id'] : '';
		
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
				$rezsize_path	= 'assets/pics/'.$resize_Img;
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
		$where_data = array('id' => $id);
		$set_data = array(
			'res_name'			=> $_POST['res_name'],
			'res_area_num'		=> $res_Area_num,
			'res_tel_num'		=> $_POST['res_tel_num'],
			'res_region'		=> $_POST['res_region'],
			'res_section'		=> $_POST['res_section'],
			'res_address'		=> $_POST['res_address'],
			'res_foodtype'		=> $_POST['res_foodtype'],
			'res_price'			=> $_POST['res_price'],
			'res_open_time'		=> $open_Time,
			'res_close_time'	=> $close_Time,
			'res_note'			=> $res_Note
		);
		if( !empty($resize_Img) )
		{
			$set_data['res_img_url']		= $resize_Img;
			$set_data['res_img_ori_url']	= $resize_ori_Img;
		}
		
		if($id == '')
		{
			$this->random_model->save_restaurant($set_data);
			$save_status = true;
		}
		else
		{
			$where_data = array('id' => $id);
			$this->random_model->update_restaurant($set_data,$where_data);
			$save_status = true;
		}
		
		if($save_status)
		{
			if( !empty($id) )
			{
				$this->load->view('admin/save_res_data');
				header('refresh:3;url='.base_url().'admin/res_detail/'.$id.'?p='.$_POST['list_record']);
			}
			else
			{
				$this->load->view('admin/save_res_data');
				header('refresh:3;url='.base_url().'admin/res_list/1');
			}
		}
	}
	
	// 未審核分享餐廳列表
	public function post_unreview($set)
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		$where_arr = array();
		$keyword = '';
		$get_max = '';
		$get_min = '';
		$get_type = '';
		
		// 未審核
		$where_arr['post_prove'] = '0';
		
		// 關鍵字處理
		if(!empty($_GET['search_keyword']))
		{
			$keyword = $_GET['search_keyword'];
			$search_keyword_value = $_GET['search_keyword'];
		}
		else
		{
			$search_keyword_value = '';
		}
		
		// 條件處理
		if( !empty($_GET['url_maxmoney']) )
		{
			if( $_GET['url_maxmoney'] != 0 )
			{
				$where_arr['post_price <='] = $_GET['url_maxmoney'];
				$get_max = $_GET['url_maxmoney'];
			}
		}
		if( !empty($_GET['url_minmoney']) )
		{
			if( $_GET['url_minmoney'] != 0 )
			{
				$where_arr['post_price >='] = $_GET['url_minmoney'];
				$get_min = $_GET['url_minmoney'];
			}
		}
		if( !empty($_GET['url_foodtype']) )
		{
			if( $_GET['url_foodtype'] != 0 )
			{
				$where_arr['post_foodtype'] = $_GET['url_foodtype'];
				$get_type = $_GET['url_foodtype'];
			}
		}
		
		$sufix_q = ( empty($_GET) ) ? '' : '?';
		
		// 最大金額選單
		$data['url_maxmoney_HTML'] = '<option value="0">0元</option>';
		for($money = 1; $money < 11; $money++)
		{
			if($get_max == ((int)$money*100))
			{
				$data['url_maxmoney_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
			}
			else
			{
				$data['url_maxmoney_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
			}
		}
		
		// 最小金額選單
		$data['url_minmoney_HTML'] = '<option value="0">0元</option>';
		for($money = 1; $money < 11; $money++)
		{
			if($get_min == ((int)$money*100))
			{
				$data['url_minmoney_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
			}
			else
			{
				$data['url_minmoney_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
			}
		}
		
		// 類型選單
		$data['res_foodtype_HTML'] = '<option value="0">都可以</option>';
		foreach($Foodtype as $key => $val){
			if($get_type == $key)
			{
				$data['res_foodtype_HTML'] .= "<option value='".$key."' selected='selected'>".$val."</option>";
			}
			else
			{
				$data['res_foodtype_HTML'] .= "<option value='".$key."'>".$val."</option>";
			}
		}
		
		// 關鍵字紀錄
		$data['search_keyword_value'] = $search_keyword_value;
		
		$this->login_check();
		$this->load->library('pagination');
		
		// 分頁設定樣式
		$config = $this->pagenation_style();
		
		// 分頁
		$config['base_url']		= base_url().'admin/post_unreview/';//設定頁面輸出網址
		$config['first_url']	= 'admin/post_unreview/1'.$sufix_q.http_build_query($_GET, '', '&');
		$config['suffix']		= $sufix_q.http_build_query($_GET, '', '&');
		$config['total_rows']	= $this->random_model->all_where_post($where_arr,$keyword); //計算所有筆數
		$config['per_page']		= '10'; //一個分頁的數量
		
		$config['num_links']	= 3;
		
		$this->pagination->initialize($config);
		$data['pages']	= $this->pagination->create_links();
		
		$data['list_record'] = $set;
		
		// 存取餐廳資料
		$data['restuarant'] = $this->random_model->show_post_list($set,$where_arr,$keyword);
		
		$data['title'] 				= '未審核分享餐廳列表';
		$data['detail_title_eng'] 	= 'Unreview Post List';
		
		$this->load->view('admin/post_unreview', $data);
	}
	
	// 已通過分享餐廳列表
	public function post_passed($set)
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		$where_arr = array();
		$keyword = '';
		$get_max = '';
		$get_min = '';
		$get_type = '';
		
		// 已通過
		$where_arr['post_prove'] = '1';
		
		// 關鍵字處理
		if(!empty($_GET['search_keyword']))
		{
			$keyword = $_GET['search_keyword'];
			$search_keyword_value = $_GET['search_keyword'];
		}
		else
		{
			$search_keyword_value = '';
		}
		
		// 條件處理
		if( !empty($_GET['url_maxmoney']) )
		{
			if( $_GET['url_maxmoney'] != 0 )
			{
				$where_arr['post_price <='] = $_GET['url_maxmoney'];
				$get_max = $_GET['url_maxmoney'];
			}
		}
		if( !empty($_GET['url_minmoney']) )
		{
			if( $_GET['url_minmoney'] != 0 )
			{
				$where_arr['post_price >='] = $_GET['url_minmoney'];
				$get_min = $_GET['url_minmoney'];
			}
		}
		if( !empty($_GET['url_foodtype']) )
		{
			if( $_GET['url_foodtype'] != 0 )
			{
				$where_arr['post_foodtype'] = $_GET['url_foodtype'];
				$get_type = $_GET['url_foodtype'];
			}
		}
		
		$sufix_q = ( empty($_GET) ) ? '' : '?';
		
		// 最大金額選單
		$data['url_maxmoney_HTML'] = '<option value="0">0元</option>';
		for($money = 1; $money < 11; $money++)
		{
			if($get_max == ((int)$money*100))
			{
				$data['url_maxmoney_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
			}
			else
			{
				$data['url_maxmoney_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
			}
		}
		
		// 最小金額選單
		$data['url_minmoney_HTML'] = '<option value="0">0元</option>';
		for($money = 1; $money < 11; $money++)
		{
			if($get_min == ((int)$money*100))
			{
				$data['url_minmoney_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
			}
			else
			{
				$data['url_minmoney_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
			}
		}
		
		// 類型選單
		$data['res_foodtype_HTML'] = '<option value="0">都可以</option>';
		foreach($Foodtype as $key => $val){
			if($get_type == $key)
			{
				$data['res_foodtype_HTML'] .= "<option value='".$key."' selected='selected'>".$val."</option>";
			}
			else
			{
				$data['res_foodtype_HTML'] .= "<option value='".$key."'>".$val."</option>";
			}
		}
		
		// 關鍵字紀錄
		$data['search_keyword_value'] = $search_keyword_value;
		
		$this->login_check();
		$this->load->library('pagination');
		
		// 分頁設定樣式
		$config = $this->pagenation_style();
		
		// 分頁
		$config['base_url']		= base_url().'admin/post_passed/';//設定頁面輸出網址
		$config['first_url']	= 'admin/post_passed/1'.$sufix_q.http_build_query($_GET, '', '&');
		$config['suffix']		= $sufix_q.http_build_query($_GET, '', '&');
		$config['total_rows']	= $this->random_model->all_where_post($where_arr,$keyword); //計算所有筆數
		$config['per_page']		= '10'; //一個分頁的數量
		
		$config['num_links']	= 3;
		
		$this->pagination->initialize($config);
		$data['pages']	= $this->pagination->create_links();
		
		$data['list_record'] = $set;
		
		// 存取餐廳資料
		$data['restuarant'] = $this->random_model->show_post_list($set,$where_arr,$keyword);
		
		$data['title'] 				= '已通過分享餐廳列表';
		$data['detail_title_eng'] 	= 'Passed Post List';
		
		$this->load->view('admin/post_passed', $data);
	}
	
	// 未通過分享餐廳列表
	public function post_unpass($set)
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		$where_arr = array();
		$keyword = '';
		$get_max = '';
		$get_min = '';
		$get_type = '';
		
		// 未通過
		$where_arr['post_prove'] = '2';
		
		// 關鍵字處理
		if(!empty($_GET['search_keyword']))
		{
			$keyword = $_GET['search_keyword'];
			$search_keyword_value = $_GET['search_keyword'];
		}
		else
		{
			$search_keyword_value = '';
		}
		
		// 條件處理
		if( !empty($_GET['url_maxmoney']) )
		{
			if( $_GET['url_maxmoney'] != 0 )
			{
				$where_arr['post_price <='] = $_GET['url_maxmoney'];
				$get_max = $_GET['url_maxmoney'];
			}
		}
		if( !empty($_GET['url_minmoney']) )
		{
			if( $_GET['url_minmoney'] != 0 )
			{
				$where_arr['post_price >='] = $_GET['url_minmoney'];
				$get_min = $_GET['url_minmoney'];
			}
		}
		if( !empty($_GET['url_foodtype']) )
		{
			if( $_GET['url_foodtype'] != 0 )
			{
				$where_arr['post_foodtype'] = $_GET['url_foodtype'];
				$get_type = $_GET['url_foodtype'];
			}
		}
		
		$sufix_q = ( empty($_GET) ) ? '' : '?';
		
		// 最大金額選單
		$data['url_maxmoney_HTML'] = '<option value="0">0元</option>';
		for($money = 1; $money < 11; $money++)
		{
			if($get_max == ((int)$money*100))
			{
				$data['url_maxmoney_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
			}
			else
			{
				$data['url_maxmoney_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
			}
		}
		
		// 最小金額選單
		$data['url_minmoney_HTML'] = '<option value="0">0元</option>';
		for($money = 1; $money < 11; $money++)
		{
			if($get_min == ((int)$money*100))
			{
				$data['url_minmoney_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
			}
			else
			{
				$data['url_minmoney_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
			}
		}
		
		// 類型選單
		$data['res_foodtype_HTML'] = '<option value="0">都可以</option>';
		foreach($Foodtype as $key => $val){
			if($get_type == $key)
			{
				$data['res_foodtype_HTML'] .= "<option value='".$key."' selected='selected'>".$val."</option>";
			}
			else
			{
				$data['res_foodtype_HTML'] .= "<option value='".$key."'>".$val."</option>";
			}
		}
		
		// 關鍵字紀錄
		$data['search_keyword_value'] = $search_keyword_value;
		
		$this->login_check();
		$this->load->library('pagination');
		
		// 分頁設定樣式
		$config = $this->pagenation_style();
		
		// 分頁
		$config['base_url']		= base_url().'admin/post_unpass/';//設定頁面輸出網址
		$config['first_url']	= 'admin/post_unpass/1'.$sufix_q.http_build_query($_GET, '', '&');
		$config['suffix']		= $sufix_q.http_build_query($_GET, '', '&');
		$config['total_rows']	= $this->random_model->all_where_post($where_arr,$keyword); //計算所有筆數
		$config['per_page']		= '10'; //一個分頁的數量
		
		$config['num_links']	= 3;
		
		$this->pagination->initialize($config);
		$data['pages']	= $this->pagination->create_links();
		
		$data['list_record'] = $set;
		
		// 存取餐廳資料
		$data['restuarant'] = $this->random_model->show_post_list($set,$where_arr,$keyword);
		
		$data['title'] 				= '未通過分享餐廳列表';
		$data['detail_title_eng'] 	= 'Unpass Post List';
		
		$this->load->view('admin/post_unpass', $data);
	}
	
	// 分享餐廳審核
	public function post_edit($post_id)
	{
		$this->login_check();
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/area.inc.php');
		require(APPPATH .'rf_config/type.inc.php');
		
		// 頁數紀錄
		$list_record 	= (!empty($_GET['p'])) ? $_GET['p'] : '';
		
		// 列表紀錄
		$list_url		= (!empty($_GET['list'])) ? $_GET['list'] : '';
		
		$data['list_record']		= $list_record;
		$data['list_url']			= $list_url;
		
		$data['restuarant'] 		= $this->random_model->show_post($post_id);
		
		// 食記讀取
		$query = $this->db->get_where('r_bloglink', array('b_post_id' => $post_id));
		$query_arr = $query->result_array();
		$data['blog'] = $query_arr;
		
		switch($data['restuarant'][0]['post_prove'])
		{
			case '0':
				$data['label_class'] = 'default';
				$data['label_title'] = '未審核';
			break;
			case '1':
				$data['label_class'] = 'success';
				$data['label_title'] = '已通過';
			break;
			case '2':
				$data['label_class'] = 'warning';
				$data['label_title'] = '未通過';
			break;
		}
		
		$data['config']['regionid'] = $Regionid;
		$data['config']['sectionid'] = $Sectionid;
		$data['config']['foodtype'] = $Foodtype;
		$data['title'] 				= '審核分享餐廳資料';
		$data['detail_title_eng'] 	= 'Post Review';
		
		$this->load->view('admin/post_edit', $data);
	}
	
	// 審核分享餐廳資料
	public function save_post_data()
	{
		$post_id		= ($_POST['post_id']) ? $_POST['post_id'] : '';
		
		// 不通過
		switch($_POST['send_status'])
		{
			case '2':
				$set_data = array(
					'post_prove' => $_POST['send_status']
				);
				$where_data = array('id' => $post_id);
				$this->db->update('r_post', $set_data , $where_data);
				
				// 更新餐廳列表 下架
				$query 		= $this->db->get_where('r_restaurant', array('res_post_id' => $post_id));
				$query_arr 	= $query->result_array();
				if( !empty($query_arr) )
				{
					$this->db->update('r_restaurant', array('res_close' => '1') , array('res_post_id' => $post_id));
				}
				
				$this->load->view('admin/save_res_data');
				header('refresh:3;url='.base_url().'admin/post_unreview/1');
			break;
		// 通過
			case '1':
				// 資料處理
				$open_Time		= (!empty($_POST['open_time_hr']) && !empty($_POST['open_time_min'])) ? strtotime($_POST['open_time_hr'].':'.$_POST['open_time_min'].':00') : '';
				$close_Time		= (!empty($_POST['close_time_hr']) && !empty($_POST['close_time_min'])) ?strtotime($_POST['close_time_hr'].':'.$_POST['close_time_min'].':00') : '';
				$res_Area_num	= str_pad($_POST['res_area_num'], 2, '0', STR_PAD_LEFT);
				$res_Note		= ($_POST['res_note']) ? nl2br($_POST['res_note']) : '';
				
				// 照片處理
				$resize_Img = "";
				$resize_ori_Img = "";
				if ($_FILES['img_url']['error'] > 0)
				{
					if($_FILES['img_url']['error'] == 4)
					{
						if( !empty($_POST['post_img_url']) )
						{
							$post_img_url	= 'assets/post/'.$_POST['post_img_url'];
							$res_img_url	= 'assets/pics/'.$_POST['post_img_url'];
							copy($post_img_url,$res_img_url);
							$resize_Img		= $_POST['post_img_url'];
						}
					}
				}
				else
				{
					$tmp_file		= 'assets/tmp/'.$_FILES['img_url']['name'];
					$img_type		= explode(".",$_FILES["img_url"]["name"]);
					$resize_Img 	= 'preview_'.time().'.'.$img_type[1];
					$rezsize_path	= 'assets/pics/'.$resize_Img;
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
				
				// 將取得資料轉為陣列
				$set_data = array(
					'res_name'			=> $_POST['res_name'],
					'res_area_num'		=> $res_Area_num,
					'res_tel_num'		=> $_POST['res_tel_num'],
					'res_region'		=> $_POST['res_region'],
					'res_section'		=> $_POST['res_section'],
					'res_address'		=> $_POST['res_address'],
					'res_foodtype'		=> $_POST['res_foodtype'],
					'res_price'			=> $_POST['res_price'],
					'res_open_time'		=> $open_Time,
					'res_close_time'	=> $close_Time,
					'res_note'			=> $res_Note,
					'res_updatetime'	=> time(),
					'res_post_id'		=> $post_id
				);
				if( !empty($resize_Img) )
				{
					$set_data['res_img_url']		= $resize_Img;
					$set_data['res_img_ori_url']	= $resize_ori_Img;
				}
				
				$res_id = $this->random_model->save_post_to_restaurant($set_data);
				
				// 食記更新上架
				$set_data = array();
				for( $i = 1; $i < 5; $i++ )
				{
					if( !empty($_POST['res_blogname'.$i]) && !empty($_POST['res_bloglink'.$i]) )
					{
						$set_data = array(
							'b_blogname'		=> $_POST['res_blogname'.$i],
							'b_bloglink'		=> $_POST['res_bloglink'.$i],
							'b_res_id'			=> $res_id,
							'b_blog_show'		=> '1'
						);
						$where_arr = array('id' => $_POST['blog_id'.$i]);
						$this->db->update('r_bloglink', $set_data , $where_arr);
					}
				}
				
				// 餐廳更新已通過
				$post_set_data = array('post_prove' => '1');
				$post_where_arr = array('id' => $post_id);
				$this->db->update('r_post', $post_set_data , $post_where_arr);
				
				$this->load->view('admin/save_res_data');
				header('refresh:3;url='.base_url().'admin/post_unreview/1');
			break;
		}
	}
	
	// 未審核食記列表
	public function blog_unreview($set)
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/type.inc.php');
		$where_arr		= array();
		$blog_where_arr = array();
		$res_id_arr		= array();
		$data['list_sel'] = array(0=>'',1=>'',2=>'');
		$res_search_flag = false;
		$blog_keyword = '';
		$keyword = '';
		$s_blog_id = '';
		$get_max = '';
		$get_min = '';
		$get_type = '';
		
		// 列表切換
		if(!empty($_GET['blog_show']) && $_GET['blog_show'] != 0)
		{
			$blog_where_arr['b_blog_show'] = $_GET['blog_show'];
		}
		else
		{
			$blog_where_arr['b_blog_show'] = '0';
		}
		
		// 食記關鍵字處理
		if(!empty($_GET['blog_keyword']))
		{
			$blog_keyword = $_GET['blog_keyword'];
		}
		
		// 食記編號處理
		if(!empty($_GET['blog_id']))
		{
			$blog_where_arr['id'] = $_GET['blog_id'];
			$s_blog_id = $_GET['blog_id'];
		}
		
		// 餐廳關鍵字處理
		if(!empty($_GET['search_keyword']))
		{
			$keyword = $_GET['search_keyword'];
			$search_keyword_value = $_GET['search_keyword'];
			$res_search_flag = true;
		}
		else
		{
			$search_keyword_value = '';
		}
		
		// 條件處理
		if( !empty($_GET['url_maxmoney']) )
		{
			if( $_GET['url_maxmoney'] != 0 )
			{
				$where_arr['res_price <='] = $_GET['url_maxmoney'];
				$get_max = $_GET['url_maxmoney'];
				
				$res_search_flag = true;
			}
		}
		if( !empty($_GET['url_minmoney']) )
		{
			if( $_GET['url_minmoney'] != 0 )
			{
				$where_arr['res_price >='] = $_GET['url_minmoney'];
				$get_min = $_GET['url_minmoney'];
				
				$res_search_flag = true;
			}
		}
		if( !empty($_GET['url_foodtype']) )
		{
			if( $_GET['url_foodtype'] != 0 )
			{
				$where_arr['res_foodtype'] = $_GET['url_foodtype'];
				$get_type = $_GET['url_foodtype'];
				
				$res_search_flag = true;
			}
		}
		
		$sufix_q = ( empty($_GET) ) ? '' : '?';
		
		// 若依餐廳條件搜尋 則先查詢餐廳編號
		if( $res_search_flag == true )
		{
			$this->db->select('id');
			if(!empty($where_arr))
			{
				$this->db->where($where_arr);
			}
			if($keyword != '')
			{
				$this->db->where("(res_name LIKE '%$keyword%' OR res_note LIKE '%$keyword%')", null, false);
			}
			$query 		= $this->db->get('r_restaurant');
			$query_arr 	= $query->result_array();
			foreach($query_arr as $key => $val)
			{
				$res_id_arr[] = $val['id'];
			}
			if(count($res_id_arr) == 0)
			{
				$res_id_arr[] = 9999999;
			}
		}
		
		// 最大金額選單
		$data['url_maxmoney_HTML'] = '<option value="0">0元</option>';
		for($money = 1; $money < 11; $money++)
		{
			if($get_max == ((int)$money*100))
			{
				$data['url_maxmoney_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
			}
			else
			{
				$data['url_maxmoney_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
			}
		}
		
		// 最小金額選單
		$data['url_minmoney_HTML'] = '<option value="0">0元</option>';
		for($money = 1; $money < 11; $money++)
		{
			if($get_min == ((int)$money*100))
			{
				$data['url_minmoney_HTML'] .= "<option value='".((int)$money*100)."' selected='selected'>".((int)$money*100)."元左右</option>";
			}
			else
			{
				$data['url_minmoney_HTML'] .= "<option value='".((int)$money*100)."'>".((int)$money*100)."元左右</option>";
			}
		}
		
		// 類型選單
		$data['res_foodtype_HTML'] = '<option value="0">都可以</option>';
		foreach($Foodtype as $key => $val){
			if($get_type == $key)
			{
				$data['res_foodtype_HTML'] .= "<option value='".$key."' selected='selected'>".$val."</option>";
			}
			else
			{
				$data['res_foodtype_HTML'] .= "<option value='".$key."'>".$val."</option>";
			}
		}
		
		// 關鍵字紀錄
		$data['search_keyword_value'] = $search_keyword_value;
		$data['search_blog_keyword_value'] = $blog_keyword;
		$data['search_blogid_keyword_value'] = $s_blog_id;
		
		$this->login_check();
		$this->load->library('pagination');
		
		// 分頁設定樣式
		$config = $this->pagenation_style();
		
		// 分頁
		$config['base_url']		= base_url().'admin/blog_unreview/';//設定頁面輸出網址
		$config['first_url']	= 'admin/blog_unreview/1'.$sufix_q.http_build_query($_GET, '', '&');
		$config['suffix']		= $sufix_q.http_build_query($_GET, '', '&');
		$config['total_rows']	= $this->random_model->all_where_blog($blog_where_arr,$blog_keyword,$res_id_arr); //計算所有筆數
		$config['per_page']		= '10'; //一個分頁的數量
		
		$config['num_links']	= 3;
		
		$this->pagination->initialize($config);
		$data['pages']	= $this->pagination->create_links();
		
		$data['list_record'] = $set;
		
		// 存取餐廳資料
		$data['blog'] = $this->random_model->show_blog_list($set,$blog_where_arr,$blog_keyword,$res_id_arr);
		
		switch($blog_where_arr['b_blog_show'])
		{
			case '0':
				$data['title'] 				= '未審核食記列表';
				$data['detail_title_eng'] 	= 'Unreview Blog List';
				$data['list_sel'][0]		= 'selected="selected"';
				$data['blog_show']			= 0;
			break;
			case '1':
				$data['title'] 				= '已通過食記列表';
				$data['detail_title_eng'] 	= 'Passed Blog List';
				$data['list_sel'][1]		= 'selected="selected"';
				$data['blog_show']			= 1;
			break;
			case '2':
				$data['title'] 				= '未通過食記列表';
				$data['detail_title_eng'] 	= 'Unpass Blog List';
				$data['list_sel'][2]		= 'selected="selected"';
				$data['blog_show']			= 2;
			break;
		}
		
		$this->load->view('admin/blog_unreview', $data);
	}

	// 問題建議列表
	public function feedback_list($set)
	{
		$where_arr = array();
		$keyword = '';
		
		$this->login_check();
		$this->load->library('pagination');
		
		// 分頁設定樣式
		$config = $this->pagenation_style();
		
		// 分頁
		$config['base_url'] = base_url().'admin/feedback_list/';//設定頁面輸出網址
		$config['first_url'] = 'admin/feedback_list/1';
		$config['total_rows'] = $this->random_model->all_where_feedback($where_arr,$keyword); //計算所有筆數
		$config['per_page'] = '10'; //一個分頁的數量
		
		$config['num_links'] = 3;
		
		$this->pagination->initialize($config);
		$data['pages']	= $this->pagination->create_links();
		
		$data['list_record'] = $set;
		
		// 存取問題建議資料
		$data['feedback'] = $this->random_model->show_feedback_list($set,$where_arr,$keyword);
		
		$data['title'] 				= '問題建議列表';
		$data['detail_title_eng'] 	= 'Feedback List';
		
		$this->load->view('admin/feedback_list', $data);
	}
	
	// 後台分頁連結樣式
	function pagenation_style()
	{
		// 分頁設定樣式
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
		
		$config['use_page_numbers'] = TRUE;
		
		return $config;
	}
	
	// 後台登出
	function logout()
	{
		$this->nativesession->delete('id');
		header('Location:'.base_url().'admin');
	}
	
	// 後台登入檢查
	function login_check()
	{
		require(APPPATH .'rf_config/admin.inc.php');
		if(array_key_exists($this->nativesession->get('id'),$admin_list) == false)
		{
			header('Location:'.base_url().'admin');
		}
		else
		{
			return;
		}
	}
	
	// 問題建議列表
	public function fix_address()
	{
		$query 		= $this->db->get('r_restaurant');
		$query_arr 	= $query->result_array();
		foreach($query_arr as $data_arr)
		{
			$res_address = str_replace('萬華區','',$data_arr['res_address']);
			$this->db->update('r_restaurant', array('res_address' => $res_address) , array('id' => $data_arr['id']));
		}
		echo 'ok';
	}
}
?>