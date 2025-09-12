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
			列表切換
			<p>
				<form action="admin/blog_unreview/1" method="get" name="switch_list" role="form">
					<select id="blog_show" name="blog_show" class="form-control">
						<option value="">請選擇</option>
						<option value="0" <?php echo $list_sel[0];?>>未審核列表</option>
						<option value="1" <?php echo $list_sel[1];?>>已通過列表</option>
						<option value="2" <?php echo $list_sel[2];?>>未通過列表</option>
					</select>
				</form>
			</p>
			依餐廳搜尋
			<p>
				<form action="admin/blog_unreview/1" method="get" name="form_res_search" role="form">
					<input type="hidden" name="blog_show" value="<?php echo $blog_show;?>">
					<div class="form-group">關鍵字
						<input type="text" class="form-control" name="search_keyword" id="search_keyword" value="<? echo $search_keyword_value;?>" placeholder="請輸入關鍵字">
					</div>
					<div class="form-group">最小金額
						<select id="url_minmoney" name="url_minmoney" class="form-control">
							<?php
								echo $url_minmoney_HTML;
							?>
						</select>
					</div>
					<div class="form-group">最大金額
						<select id="url_maxmoney" name="url_maxmoney" class="form-control">
							<?php
								echo $url_maxmoney_HTML;
							?>
						</select>
					</div>
					<div class="form-group">餐廳類形
						<select id="url_foodtype" name="url_foodtype" class="form-control">
							<?php
								echo $res_foodtype_HTML;
							?>
						</select>
					</div>
					<button type="submit" class="btn btn-primary" name="send_res" id="send_res" >搜尋</button>
					<a href="admin/blog_unreview/1"><button type="button" class="btn btn-warning" name="clear" id="clear" >清除條件</button></a>
				</form>
			</p>
			依食記搜尋
			<p>
				<form action="admin/blog_unreview/1" method="get" name="form_blog_search" role="form">
					<input type="hidden" name="blog_show" value="<?php echo $blog_show;?>">
					<div class="form-group">食記編號
						<input type="text" class="form-control" name="blog_id" id="blog_id" value="<? echo $search_blogid_keyword_value;?>" placeholder="請輸入關鍵字">
					</div>
					<div class="form-group">關鍵字
						<input type="text" class="form-control" name="blog_keyword" id="blog_keyword" value="<? echo $search_blog_keyword_value;?>" placeholder="請輸入關鍵字">
					</div>
					<button type="submit" class="btn btn-primary" name="send_blog" id="send_blog" >搜尋</button>
					<a href="admin/blog_unreview/1"><button type="button" class="btn btn-warning" name="clear" id="clear" >清除條件</button></a>
				</form>
			</p>
		</div>
		<div class="row">
			<?php 
			if(!empty($blog))
			{
				foreach ($blog as $blog_data)
				{?>
					<div class="col-12-lg">
						<div class="fix_blog">
							<p>
								<button type="button" class="btn btn-success" name="btn_pass_<?php echo $blog_data['id'];?>" id="btn_pass_<?php echo $blog_data['id'];?>" onclick="pass_blog('<?php echo $blog_data['id'];?>');">通過</button>
								<button type="button" class="btn btn-warning" name="btn_unpass_<?php echo $blog_data['id'];?>" id="btn_unpass_<?php echo $blog_data['id'];?>" onclick="unpass_blog('<?php echo $blog_data['id'];?>');">不通過</button>
								<button type="button" class="btn btn-primary" name="btn_edit_<?php echo $blog_data['id'];?>" id="btn_edit_<?php echo $blog_data['id'];?>" onclick="edit_blog('<?php echo $blog_data['id'];?>');">編輯</button>
								<button type="button" class="btn btn-primary" style="display:none;" name="btn_fix_<?php echo $blog_data['id'];?>" id="btn_fix_<?php echo $blog_data['id'];?>" onclick="fix_blog('<?php echo $blog_data['id'];?>');">修改</button>
								<button type="button" class="btn btn-default" style="display:none;" name="btn_cancel_<?php echo $blog_data['id'];?>" id="btn_cancel_<?php echo $blog_data['id'];?>" onclick="cancel_blog('<?php echo $blog_data['id'];?>');">取消</button>
							</p>
						</div>
						<div>
						<h4>
						<?php echo $blog_data['id'];?>. 
						<span id="name_show_<?php echo $blog_data['id'];?>">
							<a href="<?php echo $blog_data['b_bloglink'];?>" target="_blank"><?php echo $blog_data['b_blogname'];?></a>
						</span>
						<span id="name_edit_<?php echo $blog_data['id'];?>" class="edit_blog_detail">
							<input type="text" class="form-control edit_blogname_input" name="b_blogname_<?php echo $blog_data['id'];?>" id="b_blogname_<?php echo $blog_data['id'];?>" value="<?php echo $blog_data['b_blogname'];?>" >
						</span>
						</h4>
						<p>
						<span id="url_show_<?php echo $blog_data['id'];?>">
							URL：<?php echo $blog_data['b_bloglink'];?>
						</span>
						<span id="url_edit_<?php echo $blog_data['id'];?>" class="edit_blog_detail">
							<input type="text" class="form-control edit_bloglink_input" name="b_bloglink_<?php echo $blog_data['id'];?>" id="b_bloglink_<?php echo $blog_data['id'];?>" value="<?php echo $blog_data['b_bloglink'];?>" >
						</span>
						</p>
						<div class="alert alert-danger" id="msg_<?php echo $blog_data['id'];?>" style="display:none;">食記名稱或連結不得為空值</div>
						<?php	if($blog_data['b_res_id'] != '0')
							{?>
							<p>
							餐廳編號：<a href="admin/res_detail/<?php echo $blog_data['b_res_id'];?>?p=1" target="_blank"><?php echo $blog_data['b_res_id'];?></a>
							</p>
						<?php }
								if($blog_data['b_post_id'] != '0')
							{?>
							<p>
							分享餐廳編號：<a href="admin/post_edit/<?php echo $blog_data['b_post_id'];?>" target="_blank"><?php echo $blog_data['b_post_id'];?></a>
							</p>
						<?php } ?>
						</div>
					</div>
		<?php 	}
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