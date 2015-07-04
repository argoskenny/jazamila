<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	
	<meta name="author" content="17MEET" />
	<meta name="dcterms.rightsHolder" content="jazamila.com/17MEET" />
	<meta name="description" content="17MEET 一個讓你認識新朋友的地方。" />
	<meta name="robots" content="all" />
	<meta name="googlebot" content="all" />
	
	<meta property="og:title" content="17MEET"/>
	<meta property="og:type" content="website"/>
	<meta property="og:image" content="<?php echo base_url();?>assets/img/meet/logo/oglogo.png"/>
	<meta property="og:url" content="<?php echo base_url();?>"/>
	<meta property="og:description" content="想認識新朋友嗎？17MEET讓你用最輕鬆又簡單的方式快速遇見與你有相同興趣的朋友。"/>
	
	<title><?php echo $title;?></title>
	<base href="<?php echo base_url();?>"/><!--[if IE]></base><![endif]-->
	
	<link rel="shortcut icon" href="<?php echo base_url();?>assets/img/meet/logo/meet.ico" >
	<link href="assets/css/common/bootstrap.min.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/meet/public.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/meet/friendlist.css" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
	
	<div class="navbar navbar-inverse navbar-fixed-top" role="navigation">
		<div class="container">
		<div class="navbar-header">
			<button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
			<span class="sr-only">Toggle navigation</span>
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
			</button>
			<a class="navbar-brand" href="">17MEET</a>
		</div>
		<div class="navbar-collapse collapse">
			<ul class="nav navbar-nav navbar-right">
				<li><a href="javascript:;">邀請</a></li>
				<li><a href="javascript:;">通知</a></li>
				<li><a href="member/<?php echo $mid;?>"><?php echo $account;?></a></li>
				<li><a href="logout">登出</a></li>
			</ul>
		</div><!--/.navbar-collapse -->
		</div>
	</div>
	<div class="main">
		<div class="container">
			<?php echo $list_HTML;?>
		</div>
	</div>
<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script>
<script type="text/javascript">var BASE = '<?php echo base_url();?>';</script>
<script type="text/javascript" src="assets/js/meet/friendlist.js"></script> 
</body> 
</html>