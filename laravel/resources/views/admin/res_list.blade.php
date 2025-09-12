<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	<title>{{ $title }}</title>
	<base href="{{ url('/') }}"/>
	<link rel="shortcut icon" href="{{ url('/') }}assets/img/admin/logo/admin.ico" >
	<link href="assets/css/common/bootstrap.min.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/admin/admin_list.css" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
	<div class="container">
		
		@include('admin.admin_menu')
		
		<div class="jumbotron">
			<h3>{{ $title }}</h3>
			<p>{{ $detail_title_eng }}</p>
			<p>
				<form action="admin/res_list/1" method="get" name="form_res_newdata" role="form">
					<div class="form-group">關鍵字
						<input type="text" class="form-control" name="search_keyword" id="search_keyword" value="{{ $search_keyword_value }}" placeholder="請輸入關鍵字">
					</div>
					<div class="form-group">最小金額
						<select id="url_minmoney" name="url_minmoney" class="form-control">
							{{ $url_minmoney_HTML }}
						</select>
					</div>
					<div class="form-group">最大金額
						<select id="url_maxmoney" name="url_maxmoney" class="form-control">
							{{ $url_maxmoney_HTML }}
						</select>
					</div>
					<div class="form-group">餐廳類形
						<select id="url_foodtype" name="url_foodtype" class="form-control">
							{{ $res_foodtype_HTML }}
						</select>
					</div>
					<button type="submit" class="btn btn-primary" name="send" id="send" >搜尋</button>
					<a href="admin/res_list/1"><button type="button" class="btn btn-warning" name="clear" id="clear" >清除條件</button></a>
				</form>
			</p>
		</div>
		<div class="row">
			<?php 
			if(!empty($restuarant))
			{
				foreach ($restuarant as $res_data)
				{?>
					<a class="list_a" href="admin/res_detail/{{ $res_data['id'].'?p='.$list_record }}">
						<div class="col-12-lg">
							<h4>{{ $res_data['id'] }}. {{ $res_data['res_name'] }}</h4>
							<p>{{ $res_data['res_area_num'].' - '.$res_data['res_tel_num'] }}</p>
							<p>{{ $res_data['res_region'].$res_data['res_address'] }}</p>
						</div>
					</a>
		<?php 	}
			} 
			?>
		</div>
		<div class="pages">
		{{ $pages }}
		</div>
	</div>
<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script>
<script type="text/javascript" src="assets/js/admin/newdata.js"></script>
</body>
</html>