<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	<title><?php echo $title;?></title>
	<base href="<?php echo base_url();?>"/>
	<link rel="stylesheet" type="text/css" href="assets/css/common/jquery.pageslide.css" />
	<link href="assets/css/common/bootstrap.min.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/admin/admin_login.css" rel="stylesheet" type="text/css" />
	<link rel="shortcut icon" href="<?php echo base_url();?>assets/img/admin/logo/admin.ico" >
</head>

<body ontouchstart="">
	<div class="container">

		<form class="form-signin">
			<h2 class="form-signin-heading">登入</h2>
			<input type="text" class="form-control" name="admin_id" id="admin_id" placeholder="id" autofocus="">
			<input type="password" class="form-control" name="password" id="password" placeholder="Password">
			<button class="btn btn-lg btn-primary btn-block" type="button" name="send" id="send" onClick="javascript:login();">登入</button>
			<div class="alert alert-block alert-danger fade in">
				<button type="button" class="close">×</button>
				<h4><b>帳號密碼錯誤</b></h4>
				<p>請輸入正確的帳號及密碼</p>
			</div>
		</form>
		
    </div>
</body>
<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/admin/newdata.js"></script>
</html>