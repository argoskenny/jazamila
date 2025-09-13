<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	<title>{{ $title }}</title>
	<base href="{{ url('/') }}"/>
	<link rel="shortcut icon" href="{{ url('/') }}assets/img/admin/logo/admin.ico" >
	<link href="assets/css/common/bootstrap.min.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/admin/admin_detail.css" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
	<div class="container">
	
		@include('admin.admin_menu')
		
		<div class="jumbotron bg-light p-5 rounded">
			<h3>{{ $title }}</h3>
			<p>{{ $detail_title_eng }}</p>
		</div>
		<div class="row">
		<?php foreach ($restuarant as $res_data): ?>
				<div class="col-12-lg">
					<h3>{{ $res_data['id'] }}. <a href="detail/{{ $res_data['id'] }}" target="_blank" title="點擊至前台餐廳詳細頁面">{{ $res_data['res_name'] }}</a></h3>
					<p><span>餐廳電話：</span><br />{{ $res_data['res_area_num'].' - '.$res_data['res_tel_num'] }}</p>
					<p><span>餐廳地址：</span><br />{{ $res_data['res_region'].$res_data['res_address'] }}</p>
					<p><span>美食類型：</span><br />{{ $res_data['res_foodtype'] }}</p>
					<p><span>平均價位：</span><br />{{ $res_data['res_price'] }}</p>
					<p><span>營業時間：</span><br />{{ $res_data['res_open_time_hr'].':'.$res_data['res_open_time_min'].' - '.$res_data['res_close_time_hr'].':'.$res_data['res_close_time_min'] }}</p>
					<p><span>餐廳介紹：</span><br />{{ $res_data['res_note'] }}</p>
					<p><span>餐廳照片：</span><br /><img src="assets/pics/{{ $res_data['res_img_url'] }}" width="187" height="250"></p>
					<div class="form-group">
						<a href="admin/res_list/{{ $list_record }}"><button type="button" class="btn btn-primary" />返回列表</button></a>
						<a href="admin/res_edit/{{ $res_data['id'].'?p='.$list_record }}"><button type="button" class="btn btn-primary" />編輯內容</button></a>
					</div>
				</div>
		<?php endforeach ?>
		</div>
	</div>
<script type="text/javascript" src="assets/js/common/jquery-3.7.1.min.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script>
<script type="text/javascript" src="assets/js/admin/newdata.js"></script>
</body>
</html>