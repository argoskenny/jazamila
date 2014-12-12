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
	<link href="assets/css/meet/index.css" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
	<div class="container">

		<form class="form-signin" id="loginForm">
			<div class="form-signin-heading">
				<img src="assets/img/logo/meet_logo.png" id="meetLogo">
				<br>
				輕鬆、簡單，認識新朋友！
			</div>
			<div class="alert alert-block alert-danger" id="alertMsg">
				<h4><b>帳號密碼錯誤</b></h4>
				<p>請輸入正確的帳號及密碼</p>
			</div>
			<input type="text" class="form-control" name="account" id="account" placeholder="帳號" autofocus="">
			<input type="password" class="form-control" name="password" id="password" placeholder="密碼">
			<button class="btn btn-lg btn-primary btn-block" type="button" name="send" id="send">登入</button>
			<div class="register">
				<a href="register">還沒有帳號？趕快來免費申請一個吧！</a>
			</div>
		</form>
		
    </div>
<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script>
<script type="text/javascript">var BASE = '<?php echo base_url();?>';</script>
<script type="text/javascript" src="assets/js/meet/index.js"></script> 
</body> 
</html>