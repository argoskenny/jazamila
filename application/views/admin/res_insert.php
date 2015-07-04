<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	<title><?php echo $title;?></title>
	<base href="<?php echo base_url();?>"/>
	<link rel="shortcut icon" href="<?php echo base_url();?>assets/img/admin/logo/admin.ico" >
	<link href="assets/css/common/bootstrap.min.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/admin/admin_insert.css" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
	<div class="container">
		
		<?php $this->load->view('admin/admin_menu'); ?>
		
		<div class="jumbotron">
			<h3><?php echo $title;?></h3>
			<p><?php echo $detail_title_eng;?></p>
		</div>
		
		<form action="admin/save_res_data" method="post" name="form_res_newdata" enctype="multipart/form-data" role="form">
			<input type="hidden" name="edit_id" id="edit_id" value=""/>
			<div class="form-group">
				<label for="label_res_name">餐廳名稱</label>
				<input type="text" class="form-control" name="res_name" id="res_name" value="" placeholder="請輸入餐廳名稱">
				<div id="msg1" class="msg">請填寫餐廳名稱</div>
			</div>
			<div class="form-group">
				<label for="label_res_phone">餐廳電話</label><br />
				<input type="text" class="form-control" name="res_area_num" id="res_area_num" maxlength="3" value="" > - <input type="text" class="form-control" name="res_tel_num" id="res_tel_num" maxlength="8" value="" >
			</div>
			<div class="form-group">
				<label for="label_res_region">餐廳地址</label><br />
				<select class="form-control" id="res_region" name="res_region">
					<option value='' selected="selected">請選擇</option>
						<?php
						foreach($config['regionid'] as $key => $val){
							echo "<option value='".$key."'>".$val."</option>";
						}
						?>
				</select>
				<select class="form-control" id="res_section" name="res_section">
					<option value='' selected="selected">請選擇</option>
				</select>
				<div id="msg2" class="msg">請選擇地區</div>
				<input type="text" class="form-control" name="res_address" id="res_address" value="" placeholder="請輸入餐廳地址">
				<div id="msg3" class="msg">請填寫地址</div>
			</div>
			<div class="form-group">
				<label for="label_res_foodtype">餐廳類型</label>
				<select class="form-control" id="res_foodtype" name="res_foodtype">
					<option value='' selected="selected">請選擇</option>
						<?php
							foreach($config['foodtype'] as $key => $val){
								echo "<option value='".$key."'>".$val."</option>";
							}
						?>
				</select>
				<div id="msg4" class="msg">請選擇美食類別</div>
			</div>
			<div class="form-group">
				<label for="label_res_price">平均價位</label><br />
				<input type="text" class="form-control" name="res_price" id="res_price" value="" >元
			</div>
			<div class="form-group">
				<label for="label_res_price">營業時間</label><br />
				<input type="text" class="form-control res_time" name="open_time_hr" id="open_time_hr" maxlength="2" value=""/> ：
				<input type="text" class="form-control res_time" name="open_time_min" id="open_time_min" maxlength="2" value=""/>
				至 <input type="text" class="form-control res_time" name="close_time_hr" id="close_time_hr" maxlength="2" value=""/> ：
				<input type="text" class="form-control res_time" name="close_time_min" id="close_time_min" maxlength="2" value=""/>
			</div>
			<div class="form-group">
				<label for="label_res_note">餐廳介紹</label>
				<textarea class="form-control" name="res_note" id="res_note" rows="6" placeholder="請輸入餐廳介紹"/></textarea>
			</div>
			<div class="form-group">
				<label for="label_res_note">照片上傳</label>
				<input type="file" name="img_url" id="img_url"/>
			</div>
			<button type="button" class="btn btn-primary" name="cancel" id="cancel">清空欄位</button>
			<button type="button" class="btn btn-primary" name="send" id="send" onClick="javascript:checkForm();">送出</button>
		</form>
	</div>
</body>
<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script>
<script type="text/javascript" src="assets/js/admin/newdata.js"></script> 
</html>