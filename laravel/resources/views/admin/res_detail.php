<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	<title><?php echo $title;?></title>
	<base href="<?php echo base_url();?>"/>
	<link rel="shortcut icon" href="<?php echo base_url();?>assets/img/admin/logo/admin.ico" >
	<link href="assets/css/common/bootstrap.min.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/admin/admin_detail.css" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
	<div class="container">
	
		<?php $this->load->view('admin/admin_menu'); ?>
		
		<div class="jumbotron">
			<h3><?php echo $title;?></h3>
			<p><?php echo $detail_title_eng;?></p>
		</div>
		<div class="row">
		<?php foreach ($restuarant as $res_data): ?>
				<div class="col-12-lg">
					<h3><?php echo $res_data['id'];?>. <a href="detail/<?php echo $res_data['id'];?>" target="_blank" title="點擊至前台餐廳詳細頁面"><?php echo $res_data['res_name'];?></a></h3>
					<p><span>餐廳電話：</span><br /><?php echo $res_data['res_area_num'].' - '.$res_data['res_tel_num'];?></p>
					<p><span>餐廳地址：</span><br /><?php echo $res_data['res_region'].$res_data['res_address'];?></p>
					<p><span>美食類型：</span><br /><?php echo $res_data['res_foodtype'];?></p>
					<p><span>平均價位：</span><br /><?php echo $res_data['res_price'];?></p>
					<p><span>營業時間：</span><br /><?php echo $res_data['res_open_time_hr'].':'.$res_data['res_open_time_min'].' - '.$res_data['res_close_time_hr'].':'.$res_data['res_close_time_min'];?></p>
					<p><span>餐廳介紹：</span><br /><?php echo $res_data['res_note'];?></p>
					<p><span>餐廳照片：</span><br /><img src="assets/pics/<?php echo $res_data['res_img_url'];?>" width="187" height="250"></p>
					<div class="form-group">
						<a href="admin/res_list/<?php echo $list_record;?>"><button type="button" class="btn btn-primary" />返回列表</button></a>
						<a href="admin/res_edit/<?php echo $res_data['id'].'?p='.$list_record;?>"><button type="button" class="btn btn-primary" />編輯內容</button></a>
					</div>
				</div>
		<?php endforeach ?>
		</div>
	</div>
<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script>
<script type="text/javascript" src="assets/js/admin/newdata.js"></script>
</body>
</html>