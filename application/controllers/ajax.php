<?php
class Ajax extends CI_Controller {
	
	// 建構子
	public function __construct()
	{
		parent::__construct();
		$this->load->model('random_model');
		
		// 資料庫讀取
		$this->load->database();
	}
	
	// 登入
	function login()
	{
		$this->load->library('nativesession');
		require(APPPATH .'rf_config/admin.inc.php');
		if(array_key_exists($_POST['id'],$admin_list) == true)
		{
			if($admin_list[$_POST['id']] == $_POST['pass'])
			{
				$this->nativesession->set('id',$_POST['id']);
				echo json_encode(array("status"=>"success"));
			}
			else
			{
				echo json_encode(array("status"=>"fail"));
			}
		}
		else
		{
			echo json_encode(array("status"=>"fail"));
		}
	}
	
	// 儲存餐廳資料
	function save_res_data()
	{
		// 資料處理
		$open_Time		= (!empty($_POST['open_time_hr']) && !empty($_POST['open_time_min'])) ? strtotime($_POST['open_time_hr'].':'.$_POST['open_time_min'].':00') : '';
		$close_Time		= (!empty($_POST['close_time_hr']) && !empty($_POST['close_time_min'])) ?strtotime($_POST['close_time_hr'].':'.$_POST['close_time_min'].':00') : '';
		$res_Area_num	= str_pad($_POST['res_area_num'], 2, '0', STR_PAD_LEFT);
		$res_Note		= ($_POST['res_note']) ? nl2br($_POST['res_note']) : '';
		$id				= ($_POST['edit_id']) ? $_POST['edit_id'] : '';
		
		// 將取得資料轉為陣列
		$where_data = array('id' => $id);
		$set_data = array(
			'res_name'		=> $_POST['res_name'],
			'res_area_num'	=> $res_Area_num,
			'res_tel_num'	=> $_POST['res_tel_num'],
			'res_region'	=> $_POST['res_region'],
			'res_address'	=> $_POST['res_address'],
			'res_foodtype'	=> $_POST['res_foodtype'],
			'res_price'		=> $_POST['res_price'],
			'res_open_time'	=> $open_Time,
			'res_close_time'=> $close_Time,
			'res_note'		=> $res_Note
		);
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
			echo json_encode(array("status"=>"success"));
		}
		else
		{
			echo json_encode(array("status"=>"fail"));
		}
	}
	
	// 儲存餐廳照片
	function save_res_pic()
	{
		if($_FILES['img_url']){
			if ($_FILES['img_url']['error'] > 0){
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
				/*
				else
				{
					$resize_ori_Img			= 'origin_'.time().'.'.$img_type;
					$config['new_image']	= APPPATH.'upload/'.$resize_ori_Img;
					$config['width']		= 800;
					$this->image_lib->resize();
					
					//unlink($tmp_file);
					// 是否有圖片
					$img_ready = true;
				}*/
				
				$resize_ori_Img = "";
			}
		}
		else{
			$resize_Img = "";
			$resize_ori_Img = "";
			$img_ready = false;
		}
		
		// 將取得資料轉為陣列
		$where_dara	= array('id'=>$_POST['edit_id']);
		
		$set_data	= array(
			'res_img_url'		=> $resize_Img,
			'res_img_ori_url'	=> $resize_ori_Img
		);
		
		if($this->random_model->update_restaurant($set_data,$where_dara))
		{
			echo json_encode(array("status"=>"success"));
		}
		else
		{
			echo json_encode(array("status"=>"fail"));
		}
		
	}
	
	// 修改食記內容
	function fix_blog()
	{
		$where_data = array( "id" => $_POST['blog_id'] );
		$set_data = array( "b_blogname" => $_POST['fix_blogname'] , "b_bloglink" => $_POST['fix_bloglink'] );
		$this->db->update('r_bloglink', $set_data , $where_data);
		if($this->db->update('r_bloglink', $set_data , $where_data))
		{
			echo "success";
		}
		else
		{
			echo "fail";
		}
		
	}
	
	// 通過食記內容
	function pass_blog()
	{
		$where_data = array( "id" => $_POST['blog_id'] );
		$set_data = array( "b_blog_show" => '1' );
		$this->db->update('r_bloglink', $set_data , $where_data);
		if($this->db->update('r_bloglink', $set_data , $where_data))
		{
			echo "success";
		}
		else
		{
			echo "fail";
		}
	}
	
	// 不通過食記內容
	function unpass_blog()
	{
		$where_data = array( "id" => $_POST['blog_id'] );
		$set_data = array( "b_blog_show" => '2' );
		$this->db->update('r_bloglink', $set_data , $where_data);
		if($this->db->update('r_bloglink', $set_data , $where_data))
		{
			echo "success";
		}
		else
		{
			echo "fail";
		}
	}
}
?>