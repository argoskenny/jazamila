<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	<title>{{ $title }}</title>
	<base href="{{ url('/') }}"/>
	<link rel="shortcut icon" href="{{ url('/') }}assets/img/admin/logo/admin.ico" >
	<link href="assets/css/common/bootstrap.min.css" rel="stylesheet" type="text/css" />
	<style type="text/css">
	body {
		padding: 30px;
	}

	.navbar {
		margin-bottom: 30px;
	}
	.navbar-collapse, .navbar-collapse li
	{
		font-size:15px;
	}
	@Media (max-width: 767px)
	{
		body
		{
			padding: 10px;
		}
		.container
		{
			padding:0px;
		}
	}
	</style>
</head>

<body ontouchstart="">
<div class="container">
	
	@include('admin.admin_menu')
	
	<div class="jumbotron">
		<h1>歡迎</h1>
		<p>請選擇功能及細項。</p>
	</div>
</div>
</body>
<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script> 
<script type="text/javascript" src="assets/js/admin/newdata.js"></script> 
</html>