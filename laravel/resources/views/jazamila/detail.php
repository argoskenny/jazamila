<?php foreach ($restuarant as $res_data): ?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	
	<meta name="author" content="JAZAMILA" />
	<meta name="dcterms.rightsHolder" content="jazamila.com" />
	<meta name="description" content="<?php echo $res_data['res_name'];?>的餐廳詳細資料" />
	<meta name="robots" content="all" />
	<meta name="googlebot" content="all" />
	
	<meta property="og:title" content="JAZAMILA - <?php echo $res_data['res_name'];?>" />
	<meta property="og:type" content="restaurant.restaurant" />
	<meta property="og:image" content="<?php echo base_url();?>assets/pics/<?php echo $res_data['res_img_url']?>"/>
	<meta property="og:url" content="<?php echo base_url().'detail/'.$res_data['id'];?>" />
	<meta property="og:description" content="<?php echo $res_data['res_name'];?>的餐廳詳細資料。電話：<?php 
											if($res_data['res_area_num'] == '00' && $res_data['res_tel_num'] == '0')
											{
												echo '未提供市話';
											}
											else
											{
												echo $res_data['res_area_num'].' - '.$res_data['res_tel_num'];
											}?>，地址：<?php echo $res_data['res_region'].$res_data['res_address'];?>，類型：<?php echo $res_data['res_foodtype'];?>" />
	
	<title>JAZAMILA - <?php echo $res_data['res_name'];?></title>
	<base href="<?php echo base_url();?>"/>
	
	<link rel="shortcut icon" href="<?php echo base_url();?>assets/img/jazamila/logo/jazamila.ico" >
	<link href="assets/css/common/bootstrap.min.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/jazamila/header_footer.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/jazamila/detail.css" rel="stylesheet" type="text/css" />
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
				<a class="navbar-brand" href="<?php echo base_url();?>"><img src="assets/img/jazamila/logo/jazamila_logo.png" alt="JAZAMILA logo"></a>
			</div>
			<div class="navbar-collapse collapse">
				<ul class="nav navbar-nav navbar-right">
				  <li class="active"><a href="listdata/0/0/0/0/1">餐廳列表</a></li>
				  <li><a href="about">關於本站</a></li>
				  <li><a href="post">餐廳分享</a></li>
				</ul>
			</div>
		</div>
	</div>
	<div class="main">
		<div class="container">
			<div class="col-lg-12 main_text">今天就吃...</div>
			<div class="col-lg-12 main_title"><?php echo $res_data['res_name'];?></div>
		<?php if( !empty($res_data['res_img_url']) )
			{?>
				<div class="col-xs-12 col-md-6 res_pic"><img src="assets/pics/<?php echo $res_data['res_img_url']?>" alt="<?php echo $res_data['res_name'];?>"></div>
		<?php }
			else
			{ ?>
				<div class="col-xs-12 col-md-6 res_pic"><img src="assets/imgs/default_res_pic.jpg" alt="<?php echo $res_data['res_name'];?>" title="未提供餐廳照片"></div>
		<?php }?>
			<div class="col-xs-12 col-md-6 res_detail">
				<div class="basic_info">
					<span>餐廳名稱：</span><a href="http://www.google.com.tw/search?q=<?php echo $res_data['res_name'];?>" target="_blank" id="name_remind"><?php echo $res_data['res_name'];?></a><br />
					<em class="name_remind_class">點選名稱可搜尋餐廳資料</em>
					<span>餐廳電話：</span><?php 
					if($res_data['res_area_num'] == '00' && $res_data['res_tel_num'] == '0')
					{
						echo '<span>未提供市話</span>';
					}
					else
					{
						echo $res_data['res_area_num'].' - '.$res_data['res_tel_num'];
					}
					?><br />
					<span>餐廳地址：</span><a href="http://maps.google.com/maps?q=<?php echo $res_data['res_region'].$res_data['res_section'].$res_data['res_address'];?>" target="_blank" id="map_remind"><?php echo $res_data['res_region'].$res_data['res_section'].$res_data['res_address'];?></a><br />
					<em class="map_remind_class">點選地址可觀看地圖</em>
					<span>美食類型：</span><?php echo $res_data['res_foodtype'];?><br />
					<span>平均價位：</span><?php echo $res_price = ($res_data['res_price'] != 0) ? $res_data['res_price'] : '<span>未提供均價</span>';?><br />
					<span>營業時間：</span><?php 
						if( !empty($res_data['res_open_time_hr']) && !empty($res_data['res_open_time_min']) && !empty($res_data['res_close_time_hr']) && !empty($res_data['res_close_time_min']) )
						{
							echo $res_data['res_open_time_hr'].':'.$res_data['res_open_time_min'].' - '.$res_data['res_close_time_hr'].':'.$res_data['res_close_time_min'];
						}
						else
						{
							echo '<span>未提供營業時間</span>';
						}
					?>
					<br />
				</div>
<?php 	echo $res_data['res_note'];
		endforeach ?>
				<div class="blog_info">
				 <?php 	if( !empty($blog) )
						{
							echo '<span>食記介紹：</span><br />';
						
							foreach ($blog as $blogarr):
								echo '<a href="'.$blogarr['b_bloglink'].'" target="_blank" title="'.$blogarr['b_blogname'].'" alt="'.$blogarr['b_blogname'].'" >
									'.$blogarr['b_blogname'].'
									</a><br />';
							endforeach;
						}?>
					 <a data-toggle="modal" href="#myModal"><b>+</b>&nbsp;&nbsp;新增食記</a>
				</div>
				<div class="share_info">
					<div class="col-xs-6 col-sm-3 share_links">
						<a href="javascript:;" onclick='window.open("https://www.facebook.com/sharer.php?u=<?php echo base_url();?>detail/<?php echo $res_data['id'];?>", "facebook_frm","height=450,width=540");' title="分享至Facebook">
							<img src="assets/img/jazamila/icon/fb_share.png" title="分享至Facebook" alt="Facebook share"/>
						</a>
					</div>
					<div class="col-xs-6 col-sm-3 share_links">
						<a href="javascript:desc='';if(window.getSelection)desc=window.getSelection();if(document.getSelection)desc=document.getSelection();if(document.selection)desc=document.selection.createRange().text;void(open('http://twitter.com/?status='+encodeURIComponent(location.href+' ('+document.title.split('@')[0].replace(/([\s]*$)/g,'')+')')));" title="分享至twitter">
							<img src="assets/img/jazamila/icon/tweet_share.png" title="分享至Twitter" alt="Twitter share"/>
						</a>
					</div>
					<div class="col-xs-6 col-sm-3 share_links">
						<a href="javascript:desc='';if(window.getSelection)desc=window.getSelection();if(document.getSelection)desc=document.getSelection();if(document.selection)desc=document.selection.createRange().text;void(open('http://www.plurk.com/?qualifier=shares&amp;status='+encodeURIComponent(location.href+' ('+document.title.split('@')[0].replace(/([\s]*$)/g,'')+')')));" title="分享至PLURK">
							<img src="assets/img/jazamila/icon/plurk_share.png" title="分享至Plurk" alt="Plurk share"/>
						</a>
					</div>
					<div class="col-xs-6 col-sm-3 share_links">
						<a target="_blank" href="javascript:void(window.open('https://plus.google.com/share?url='.concat(encodeURIComponent(location.href)), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=600,width=600'));">
							<img src="assets/img/jazamila/icon/google_share.png" title="分享至Google+" alt="Google Plus share"/>
						</a>
					</div>
				</div>
			</div>
			
		</div>
	</div>
	<div class="share">
		<div class="container">
			<div class="row">
				<div class="col-xs-12 col-lg-12 plz-share">不想吃那個？不妨來看看推薦餐廳！</div>
			</div>
			<div class="row recommend_area">
				<div class="col-xs-12 col-sm-3 recommend">
					<?php foreach ($recommend_res1 as $rec_res_data1): ?>
						<a class="td_a" href="detail/<?php echo $rec_res_data1['id'];?>"><img src="assets/pics/<?php echo $rec_res_data1['res_img_url']?>"></a><br />
						<?php echo $rec_res_data1['res_name'];?><br />
						<?php echo $rec_res_data1['res_area_num'];?> - <?php echo $rec_res_data1['res_tel_num'];?><br />
						<a href="http://maps.google.com/maps?q=<?php echo $rec_res_data1['res_region'].$rec_res_data1['res_address'];?>" target="_blank"><?php echo $rec_res_data1['res_region'].$rec_res_data1['res_address'];?></a>
					<?php endforeach ?>
				</div>
				<div class="col-xs-12 col-sm-3 recommend">
					<?php foreach ($recommend_res2 as $rec_res_data2): ?>
						<a class="td_a" href="detail/<?php echo $rec_res_data2['id'];?>"><img src="assets/pics/<?php echo $rec_res_data2['res_img_url']?>"></a><br />
						<?php echo $rec_res_data2['res_name'];?><br />
						<?php echo $rec_res_data2['res_area_num'];?> - <?php echo $rec_res_data2['res_tel_num'];?><br />
						<a href="http://maps.google.com/maps?q=<?php echo $rec_res_data2['res_region'].$rec_res_data2['res_address'];?>" target="_blank"><?php echo $rec_res_data2['res_region'].$rec_res_data2['res_address'];?></a>
					<?php endforeach ?>
				</div>
				<div class="col-xs-12 col-sm-3 recommend">
					<?php foreach ($recommend_res3 as $rec_res_data3): ?>
						<a class="td_a" href="detail/<?php echo $rec_res_data3['id'];?>"><img src="assets/pics/<?php echo $rec_res_data3['res_img_url']?>"></a><br />
						<?php echo $rec_res_data3['res_name'];?><br />
						<?php echo $rec_res_data3['res_area_num'];?> - <?php echo $rec_res_data3['res_tel_num'];?><br />
						<a href="http://maps.google.com/maps?q=<?php echo $rec_res_data3['res_region'].$rec_res_data3['res_address'];?>" target="_blank"><?php echo $rec_res_data3['res_region'].$rec_res_data3['res_address'];?></a>
					<?php endforeach ?>
				</div>
				<div class="col-xs-12 col-sm-3 recommend">
					<?php foreach ($recommend_res4 as $rec_res_data4): ?>
						<a class="td_a" href="detail/<?php echo $rec_res_data4['id'];?>"><img src="assets/pics/<?php echo $rec_res_data4['res_img_url']?>"></a><br />
						<?php echo $rec_res_data4['res_name'];?><br />
						<?php echo $rec_res_data4['res_area_num'];?> - <?php echo $rec_res_data4['res_tel_num'];?><br />
						<a href="http://maps.google.com/maps?q=<?php echo $rec_res_data4['res_region'].$rec_res_data4['res_address'];?>" target="_blank"><?php echo $rec_res_data4['res_region'].$rec_res_data4['res_address'];?></a>
					<?php endforeach ?>
				</div>
			</div>
		</div>
	</div>
	<div class="main">
		<div class="container">
			<div class="col-lg-12 main_text">還是都沒興趣？</div>
			<div class="col-lg-12">
				<button type="button" class="btn btn-primary btn-lg whattoeat" onclick="pick();">再找一次？</button>
			</div>
			<div class="col-lg-12 main_option">
				<div class="circle_btn">
					<img src="assets/img/jazamila/icon/option_btn.png">
				</div>
			</div>
			<div id="option_choose">
				<div class="col-lg-12 not_found">
					找不到餐廳耶...也許你該換個條件試試？
				</div>
				<div class="row">
					<div class="col-xs-12 col-md-4 option_select">
						<p>
							<b>吃哪邊？</b>
							<select id="foodwhere_region" name="foodwhere_region" class="form-control">
								<?php echo $foodwhere_region_HTML;?>
							</select>
						</p>
						<p>
							<b>地區或商圈</b>
							<select id="foodwhere_section" name="foodwhere_section" class="form-control">
								<?php echo $foodwhere_section_HTML;?>
							</select>
						</p>
					</div>
					<div class="col-xs-12 col-md-4 option_select">
						<p>
							<b>吃多少？</b>
							<select id="foodmoney_min" name="foodmoney_min" class="form-control">
								<?php
									echo $foodmoney_min_HTML;
								?>
							</select>
						</p>
						<p>
							<b>至</b>
							<select id="foodmoney_max" name="foodmoney_max" class="form-control">
								<?php
									echo $foodmoney_max_HTML;
								?>
							</select>
						</p>
					</div>
					<div class="col-xs-12 col-md-4 option_select">
						<b>吃哪種？</b>
						<select id="foodtype" name="foodtype" class="form-control">
							<?php
								echo $foodtype_HTML;
							?>
						</select>
					</div>
				</div>
				<div class="remember_option">
				<?php echo $remember_HTML;?> 記得我選的條件。
				</div>
			</div>
			<div class="col-lg-12">
				<a href="listdata/<?php echo $list_record;?>"><button type="button" id="back_to_list" class="btn btn-primary btn-lg">返回列表</button></a>
			</div>
		</div>
	</div>
	<div class="footer">
		<div class="container">
			<div class="col-xs-10 col-md-11">2013 JAZAMILA</div>
			<div class="col-xs-2 col-md-1"><a href="javascript:void(0)" onclick="gotop();">TOP</a></div>
		</div>
	</div>
	
	<input type="hidden" id="cookie_flag" name="cookie_flag" value="<?php echo $cookie_flag;?>">
	
	<!-- 新增食記 -->
	<div class="modal fade" id="myModal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h4 class="modal-title">新增食記</h4>
				</div>
				
				<div class="modal-body">
					<input type="text" class="form-control blogname" id="res_blogname" name="res_blogname" placeholder="請輸入食記名稱">
					<div class="msg" id="msg_blogname">請輸入食記名稱</div>
					<input type="text" class="form-control bloglink" id="res_bloglink" name="res_bloglink" placeholder="請輸入食記網址">
					<div class="msg" id="msg_bloglink">請輸入食記網址</div>
				</div>
				
				<div class="modal-footer">
					<?php foreach ($restuarant as $res_data): ?>
					<button type="button" class="btn blog_btn" onclick="blog_submit('<?php echo $res_data['id'];?>');">送出</button>
					<?php endforeach ?>
					<button type="button" class="btn btn-default cancel_btn" data-dismiss="modal">取消</button>
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div><!-- /.modal -->
	
	<!-- 儲存成功 -->
	<div class="modal fade" id="save_success" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content saveok_content">
				已儲存成功，感謝你的分享！<br />
				<button type="button" class="btn btn-default saveok_btn" data-dismiss="modal">關閉</button>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div><!-- /.modal -->

<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script>
<script type="text/javascript">var BASE = '<?php echo base_url();?>';</script>
<script type="text/javascript" src="assets/js/jazamila/detail.js"></script> 
</body>
</html>