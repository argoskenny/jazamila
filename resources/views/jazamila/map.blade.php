<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	
	<meta name="author" content="JAZAMILA" />
	<meta name="dcterms.rightsHolder" content="jazamila.com" />
	<meta name="description" content="JAZAMILA內有許多美食、餐廳的資料，幫你解決不知該吃哪間餐廳的煩惱。" />
	<meta name="robots" content="all" />
	<meta name="googlebot" content="all" />
	
	<title>{{ $title }}</title>
        <base href="{{ url('/') }}/"/>
        <link href="{{ asset('assets/css/common/bootstrap.min.css') }}" rel="stylesheet" type="text/css" />
        <link href="{{ asset('assets/css/jazamila/header_footer.css') }}" rel="stylesheet" type="text/css" />
        <link href="{{ asset('assets/css/jazamila/map.css') }}" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
	<div class="navbar navbar-default header">
		<div class="container">
			<div class="navbar-header">
				<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target=".navbar-collapse">
				  <span class="icon-bar"></span>
				  <span class="icon-bar"></span>
				  <span class="icon-bar"></span>
				</button>
                                <a class="navbar-brand" href="{{ url('/') }}"><img src="{{ asset('assets/img/jazamila/logo/jazamila_logo.png') }}"></a>
			</div>
			<div class="navbar-collapse collapse">
				<ul class="nav navbar-nav navbar-right">
				  <li><a href="listdata/0/0/0/0/1">餐廳列表</a></li>
				  <li class="active"><a href="map">美食地圖</a></li>
				  <li><a href="about">關於本站</a></li>
				</ul>
			</div>
		</div>
	</div>
	<div class="main">
	
	</div>
	<div class="share">
	
	</div>
	
	<div class="footer">
		<div class="container">
			<div class="col-xs-10 col-md-11">2013 JAZAMILA</div>
			<div class="col-xs-2 col-md-1"><a href="javascript:void(0)" onclick="gotop();">TOP</a></div>
		</div>
	</div>
<script type="text/javascript" src="{{ asset('assets/js/common/jquery-1.10.2.min.js') }}"></script>
<script type="text/javascript" src="{{ asset('assets/js/common/bootstrap.min.js') }}"></script>
<script type="text/javascript">var BASE = '{{ url('/') }}';</script>
<script type="text/javascript" src="{{ asset('assets/js/jazamila/index.js') }}"></script>
</body>
</html>