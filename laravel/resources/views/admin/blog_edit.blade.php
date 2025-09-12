<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	<title>{{ $title }}</title>
	<base href="{{ url('/') }}"/>
	<link rel="shortcut icon" href="{{ url('/') }}assets/img/admin/logo/admin.ico" >
	<link href="assets/css/common/bootstrap.min.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/admin/admin_insert.css" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
<div class="container">
	
	@include('admin.admin_menu')
	
	<div class="jumbotron">
		<h3>{{ $title }}</h3>
		<p>{{ $detail_title_eng }}</p>
	</div>
	
	<?php foreach ($restuarant as $res_data): ?>
	<form action="admin/save_res_data" method="post" name="form_res_newdata" enctype="multipart/form-data" role="form">
		<input type="hidden" name="edit_id" id="edit_id" value="{{ $res_data['id'] }}"/>
		<input type="hidden" name="list_record" id="list_record" value="{{ $list_record }}"/>
		<div class="form-group">
			<label for="label_res_name">餐廳名稱</label>
			<input type="text" class="form-control" name="res_name" id="res_name" value="{{ $res_data['res_name'] }}" placeholder="請輸入餐廳名稱">
			<div id="msg1" class="msg">請填寫餐廳名稱</div>
		</div>
		<div class="form-group">
			<label for="label_res_phone">餐廳電話</label><br />
			<input type="text" class="form-control" name="res_area_num" id="res_area_num" maxlength="3" value="{{ $res_data['res_area_num'] }}" > - <input type="text" class="form-control" name="res_tel_num" id="res_tel_num" maxlength="8" value="{{ $res_data['res_tel_num'] }}" >
		</div>
		<div class="form-group">
			<label for="label_res_region">餐廳地址</label>
			<select class="form-control" id="res_region" name="res_region">
				<option value='' selected="selected">請選擇</option>
					<?php
					foreach($config['regionid'] as $key => $val)
					{
						if($res_data['res_region'] == $val)
						{
							echo "<option value='".$key."' selected='selected'>".$val."</option>";
						}
						else
						{
							echo "<option value='".$key."'>".$val."</option>";
						}
					}
					?>
			</select>
			<div id="msg2" class="msg">請選擇地區</div>
			<input type="text" class="form-control" name="res_address" id="res_address" value="{{ $res_data['res_address'] }}" placeholder="請輸入餐廳地址">
			<div id="msg3" class="msg">請填寫地址</div>
		</div>
		<div class="form-group">
			<label for="label_res_foodtype">餐廳類型</label>
			<select class="form-control" id="res_foodtype" name="res_foodtype">
				<option value='' selected="selected">請選擇</option>
					<?php
						foreach($config['foodtype'] as $key => $val)
						{
							if($res_data['res_foodtype'] == $val)
							{
								echo "<option value='".$key."' selected='selected'>".$val."</option>";
							}
							else
							{
								echo "<option value='".$key."'>".$val."</option>";
							}
						}
					?>
			</select>
			<div id="msg4" class="msg">請選擇美食類別</div>
		</div>
		<div class="form-group">
			<label for="label_res_price">平均價位</label><br />
			<input type="text" class="form-control" name="res_price" id="res_price" value="{{ $res_data['res_price'] }}" >元
		</div>
		<div class="form-group">
			<label for="label_res_price">營業時間</label><br />
			<input type="text" class="form-control res_time" name="open_time_hr" id="open_time_hr" maxlength="2" value="{{ $res_data['res_open_time_hr'] }}"/> ：
			<input type="text" class="form-control res_time" name="open_time_min" id="open_time_min" maxlength="2" value="{{ $res_data['res_open_time_min'] }}"/>
			至 <input type="text" class="form-control res_time" name="close_time_hr" id="close_time_hr" maxlength="2" value="{{ $res_data['res_close_time_hr'] }}"/> ：
			<input type="text" class="form-control res_time" name="close_time_min" id="close_time_min" maxlength="2" value="{{ $res_data['res_close_time_min'] }}"/>
		</div>
		<div class="form-group">
			<label for="label_res_note">餐廳介紹</label>
			<textarea class="form-control" name="res_note" id="res_note" rows="6" placeholder="請輸入餐廳介紹"/>{{ $res_data['res_note'] }}</textarea>
		</div>
		<div class="form-group">
			<label for="label_res_note">照片上傳</label>
			<input type="file" name="img_url" id="img_url"/>
		</div>
		<a href="admin/res_detail/{{ $res_data['id'].'?p='.$list_record }}"><button type="button" class="btn btn-primary" name="cancel" id="cancel">取消</button></a>
		<button type="button" class="btn btn-primary" name="send" id="send" onClick="javascript:checkForm();">送出</button>
	</form>
	<?php endforeach ?>
</div>
<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script>
<script type="text/javascript" src="assets/js/admin/newdata.js"></script>
</body>
</html>