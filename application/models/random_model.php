<?php
class Random_model extends CI_Model{
	
	// 建構
	public function __construct()
	{
		$this->load->database();
	}
	
	// 餐廳總數
	public function all_restaurant()
	{
		return $this->db->count_all_results('r_restaurant');
	}
	
	// 餐廳條件查詢總數
	public function all_where_restaurant($where_arr,$keyword)
	{
		if(!empty($where_arr))
		{
			$this->db->where($where_arr);
		}
		// 關鍵字查詢
		if($keyword != '')
		{
			$this->db->where("(res_name LIKE '%$keyword%' OR res_note LIKE '%$keyword%')", null, false);
		}
		
		$this->db->from('r_restaurant');
		return $this->db->count_all_results();
	}
	
	// 餐廳資料列表讀取
	public function show_restaurant_list($set_id,$where_arr,$keyword)
	{
		$data 		= array();
		$query_arr 	= array();
		
		$set_id = ($set_id==1) ? 0 : ($set_id-1)*10; // 頁數轉換
		
		// 列表
		if(!empty($where_arr))
		{
			$this->db->where($where_arr);
		}
		// 關鍵字查詢
		if($keyword != '')
		{
			$this->db->where("(res_name LIKE '%$keyword%' OR res_note LIKE '%$keyword%')", null, false);
		}
		
		$this->db->order_by('res_region','ASC');
		$this->db->order_by('res_section','ASC');
		$this->db->limit(10,$set_id);
		$query 		= $this->db->get('r_restaurant');
		$query_arr 	= $query->result_array();
		// 防止無餐廳資料
		if(!empty($query_arr))
		{
			$data 		= $this->res_data_switch($query_arr);
			return $data;
		}
		else
		{
			return;
		}
	}
	
	// 餐廳資料讀取
	public function show_restaurant($res_id)
	{
		$data 		= array();
		$query_arr 	= array();
		
		// 詳細
		$query 		= $this->db->get_where('r_restaurant', array('id' => $res_id));
		$query_arr 	= $query->result_array();
		$data 		= $this->res_data_switch($query_arr);
		return $data;
	}
	
	// 餐廳資料儲存
	public function save_restaurant($data)
	{
		return $this->db->insert('r_restaurant', $data);
	}
	
	// 餐廳資料更新
	public function update_restaurant($set_data,$where_data)
	{
		return $this->db->update('r_restaurant', $set_data , $where_data);
	}
	
	// 分享餐廳條件查詢總數
	public function all_where_post($where_arr,$keyword)
	{
		if(!empty($where_arr))
		{
			$this->db->where($where_arr);
		}
		// 關鍵字查詢
		if($keyword != '')
		{
			$this->db->where("(post_name LIKE '%$keyword%' OR post_note LIKE '%$keyword%')", null, false);
		}
		
		$this->db->from('r_post');
		return $this->db->count_all_results();
	}
	
	// 分享餐廳列表資料讀取
	public function show_post_list($set_id,$where_arr,$keyword)
	{
		$data 		= array();
		$query_arr 	= array();
		
		$set_id = ($set_id==1) ? 0 : ($set_id-1)*10; // 頁數轉換
		
		// 列表
		if(!empty($where_arr))
		{
			$this->db->where($where_arr);
		}
		// 關鍵字查詢
		if($keyword != '')
		{
			$this->db->where("(post_name LIKE '%$keyword%' OR post_note LIKE '%$keyword%')", null, false);
		}
		
		$this->db->order_by('id','ASC');
		$this->db->limit(10,$set_id);
		$query 		= $this->db->get('r_post');
		$query_arr 	= $query->result_array();
		// 防止無餐廳資料
		if(!empty($query_arr))
		{
			$data 		= $this->post_data_switch($query_arr);
			return $data;
		}
		else
		{
			return;
		}
	}
	
	// 分享餐廳資料讀取
	public function show_post($post_id)
	{
		$data 		= array();
		$query_arr 	= array();
		
		// 詳細
		$query 		= $this->db->get_where('r_post', array('id' => $post_id));
		$query_arr 	= $query->result_array();
		$data 		= $this->post_data_switch($query_arr);
		return $data;
	}
	
	// 分享餐廳前台資料新增
	public function save_post($data)
	{
		$this->db->insert('r_post', $data);
		return $this->db->insert_id();
	}
	
	// 分享餐廳後台資料審核通過
	public function save_post_to_restaurant($data)
	{
		$this->db->insert('r_restaurant', $data);
		return $this->db->insert_id();
	}
	
	// 食記讀取 已顯示
	public function show_blog($res_id)
	{
		$data 		= array();
		$query_arr 	= array();
		
		// 詳細
		$query 		= $this->db->get_where('r_bloglink', array('b_res_id' => $res_id , 'b_blog_show' => '1'));
		return $query_arr = $query->result_array();
	}
	
	// 食記總數 同一餐廳
	public function count_blog($res_id)
	{	
		$this->db->where(array('b_res_id' => $res_id ));
		$this->db->from('r_bloglink');
		return $this->db->count_all_results();
	}
	
	// 食記儲存
	public function save_blog($data)
	{
		return $this->db->insert('r_bloglink', $data);
	}
	
	// 食記條件查詢總數
	public function all_where_blog($where_arr,$keyword,$where_in)
	{
		if(!empty($where_arr))
		{
			$this->db->where($where_arr);
		}
		// 關鍵字查詢
		if($keyword != '')
		{
			$this->db->where(" b_blogname LIKE '%$keyword%' ", null, false);
		}
		if( count($where_in) > 0 )
		{
			$this->db->where_in('b_res_id',$where_in);
		}
		
		$this->db->from('r_bloglink');
		return $this->db->count_all_results();
	}
	
	// 食記資料列表讀取
	public function show_blog_list($set_id,$where_arr,$keyword,$where_in)
	{
		$data 		= array();
		$query_arr 	= array();
		
		$set_id = ($set_id==1) ? 0 : ($set_id-1)*10; // 頁數轉換
		
		// 列表
		if(!empty($where_arr))
		{
			$this->db->where($where_arr);
		}
		// 關鍵字查詢
		if($keyword != '')
		{
			$this->db->where(" b_blogname LIKE '%$keyword%' ", null, false);
		}
		if( count($where_in) > 0 )
		{
			$this->db->where_in('b_res_id',$where_in);
		}
		
		$this->db->order_by('id','Desc');
		$this->db->limit(10,$set_id);
		$query 		= $this->db->get('r_bloglink');
		$query_arr 	= $query->result_array();
		
		// 防止無餐廳資料
		if(!empty($query_arr))
		{
			return $query_arr;
		}
		else
		{
			return;
		}
	}
	
	// 餐廳資料轉換
	function res_data_switch($query_arr)
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/area.inc.php');
		require(APPPATH .'rf_config/type.inc.php');
		
		foreach($query_arr as $data_arr)
		{
			$data_arr['res_area_num'] 		= str_pad($data_arr['res_area_num'], 2, '0', STR_PAD_LEFT);
			$data_arr['res_region'] 		= $Regionid[$data_arr['res_region']];
			$data_arr['res_section'] 		= $Sectionid[$data_arr['res_section']];
			$data_arr['res_foodtype'] 		= $Foodtype[$data_arr['res_foodtype']];
			$data_arr['res_open_time_hr']	= ( $data_arr['res_open_time'] != 0 ) ? date('H',$data_arr['res_open_time']) : '';
			$data_arr['res_open_time_min']	= ( $data_arr['res_open_time'] != 0 ) ? date('i',$data_arr['res_open_time']) : '';
			$data_arr['res_close_time_hr']	= ( $data_arr['res_close_time'] != 0 ) ? date('H',$data_arr['res_close_time']) : '';
			$data_arr['res_close_time_min']	= ( $data_arr['res_close_time'] != 0 ) ? date('i',$data_arr['res_close_time']) : '';
			$data[] = $data_arr;
		}
		return $data;
	}
	
	// 餐廳資料轉換
	function post_data_switch($query_arr)
	{
		// 載入地區與類型設定檔
		require(APPPATH .'rf_config/area.inc.php');
		require(APPPATH .'rf_config/type.inc.php');
		
		foreach($query_arr as $data_arr)
		{
			$data_arr['post_area_num'] 		= str_pad($data_arr['post_area_num'], 2, '0', STR_PAD_LEFT);
			$data_arr['post_region'] 		= $Regionid[$data_arr['post_region']];
			$data_arr['post_section'] 		= $Sectionid[$data_arr['post_section']];
			$data_arr['post_foodtype'] 		= $Foodtype[$data_arr['post_foodtype']];
			$data_arr['post_open_time_hr']	= ( $data_arr['post_open_time'] != 0 ) ? date('H',$data_arr['post_open_time']) : '';
			$data_arr['post_open_time_min']	= ( $data_arr['post_open_time'] != 0 ) ? date('i',$data_arr['post_open_time']) : '';
			$data_arr['post_close_time_hr']	= ( $data_arr['post_close_time'] != 0 ) ? date('H',$data_arr['post_close_time']) : '';
			$data_arr['post_close_time_min']= ( $data_arr['post_close_time'] != 0 ) ? date('i',$data_arr['post_close_time']) : '';
			$data[] = $data_arr;
		}
		return $data;
	}
	
	// 隨機選取餐廳資料讀取
	public function random_show_restaurant($where_arr,$random_limit)
	{
		$data 		= array();
		$query_arr 	= array();
		
		// 詳細
		if(count($where_arr) > 0)
		{
			$query 		= $this->db->get_where('r_restaurant', $where_arr , 1, $random_limit);
			$query_arr 	= $query->result_array();
			return $query_arr;
		}
		else
		{
			$query 		= $this->db->get('r_restaurant', 1, $random_limit);
			$query_arr 	= $query->result_array();
			return $query_arr;
		}
	}
	
	// 問題建議條件查詢總數
	public function all_where_feedback($where_arr,$keyword)
	{
		if(!empty($where_arr))
		{
			$this->db->where($where_arr);
		}
		// 關鍵字查詢
		if($keyword != '')
		{
			$this->db->where("(f_name LIKE '%$keyword%' OR f_content LIKE '%$keyword%')", null, false);
		}
		
		$this->db->from('r_feedback');
		return $this->db->count_all_results();
	}
	
	// 問題建議讀取
	public function show_feedback_list($set_id,$where_arr,$keyword)
	{
		$data 		= array();
		$query_arr 	= array();
		
		$set_id = ($set_id == 1) ? 0 : ($set_id-1)*10; // 頁數轉換
		
		// 列表
		if(!empty($where_arr))
		{
			$this->db->where($where_arr);
		}
		// 關鍵字查詢
		if($keyword != '')
		{
			$this->db->where("(f_name LIKE '%$keyword%' OR f_content LIKE '%$keyword%')", null, false);
		}
		
		$this->db->order_by('f_time','DESC');
		$this->db->limit(10,$set_id);
		$query 		= $this->db->get('r_feedback');
		$query_arr 	= $query->result_array();
		// 防止無資料
		if(!empty($query_arr))
		{
			return $query_arr;
		}
		else
		{
			return;
		}
	}
	
	// 問題建議儲存
	public function save_feedback($data)
	{
		return $this->db->insert('r_feedback', $data);
	}
	
}
?>