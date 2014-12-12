<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	<title><?php echo $title;?></title>
	<base href="<?php echo base_url();?>"/>
	<link rel="shortcut icon" href="<?php echo base_url();?>assets/img/admin/logo/admin.ico" >
	<link href="assets/css/common/bootstrap.min.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/admin/admin_list.css" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
	<div class="container">
		
		<?php $this->load->view('admin/admin_menu'); ?>
		
		<div class="jumbotron">
			<h3><?php echo $title;?></h3>
			<p><?php echo $detail_title_eng;?></p>
		</div>
		<div class="row">
			<?php 
			if(!empty($feedback))
			{
				foreach ($feedback as $f_data)
				{?>
					<div class="col-12-lg feed_bg<?php echo $f_data['f_isread'];?>">
						<h4><?php echo $f_data['id'];?>. <?php echo $f_data['f_name'];?></h4>
						<p><?php echo $f_email = ( empty($f_data['f_email']) ) ? '未提供電子郵件' : $f_data['f_email'];?></p>
						<p><?php echo date('Y-m-d H:i:s',$f_data['f_time']);?></p>
						<p><?php echo nl2br($f_data['f_content']);?></p>
					</div>
		<?php 	}
			}
			else
			{
				echo "查無資料";
			}
			?>
		</div>
		<div class="pages">
		<?php echo $pages;?>
		</div>
	</div>
<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script>
<script type="text/javascript" src="assets/js/admin/newdata.js"></script>
</body>
</html>