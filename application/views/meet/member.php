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
	<link href="assets/css/common/jquery.Jcrop.min.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/meet/public.css" rel="stylesheet" type="text/css" />
	<link href="assets/css/meet/member.css" rel="stylesheet" type="text/css" />
</head>

<body ontouchstart="">
<input type="hidden" id="mid" name="mid" value="<?php echo $mid;?>">
<input type="hidden" id="cropx" name="cropx" value="0">
<input type="hidden" id="cropy" name="cropy" value="0">
<input type="hidden" id="cropw" name="cropw" value="400">
<input type="hidden" id="croph" name="croph" value="560">
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
			<div class="col-xs-12 col-sm-3" id="avaterPic">
				<div class="avaterPic">
					<div class="avaterPicBorder">
						<img src="<?php echo $headPic;?>" id="my_image">
					</div>
				</div>
				<div class="avaterPic_cover" id="avaterPic_cover">
					<form name="form" action="" method="POST" name="FileForm" enctype="multipart/form-data">
						<!--
						<input type="file" id="pic_upload" name="pic_upload" class="btn-upload" value="選擇照片">
						<input type="button" id="pic_submit" name="pic_submit" class="btn btn-default" value="上傳">
						-->
						<button class="btn btn-default btn-lg btn-upload" data-toggle="modal" data-target="#upload_avater">
						上傳大頭照
						</button>
						<button class="btn btn-default btn-lg btn-upload" <?php echo $updateLock;?> data-toggle="modal" data-target="#edit_avater">
						編輯大頭照
						</button>
					</form>
				</div>
				<div class="avaterPic_loading" id="loading">
					<img src="assets/img/backgrounds/loading.gif">
				</div>
				<a href="friendList/<?php echo $mid;?>" title="好友列表">好友列表</a>
				<div class="friendList">
					<?php echo $friendListHTML;?>
				</div>
			</div>
			<div class="col-xs-12 col-sm-9">
				基本資料<a href="javascript:;" id="memberDetailEdit">編輯</a>
				<div class="memberDetail">
					<div class="col-xs-12 col-sm-6 memberDetailLeft">
						<div class="detailItem" id="memberName">
							<span class="itemTitle">暱稱</span>
							<span id="memberNameDisplay"><?php echo $memberName;?></span>
							<input type="text" id="memberNameInput" value="<?php echo $memberName;?>" style="display:none;">
						</div>
						<div class="detailItem" id="memberMobile">
							<span class="itemTitle">手機</span>
							<span id="memberMobileDisplay"><?php echo $memberMobile;?></span>
							<input type="text" id="memberMobileInput" value="<?php echo $memberMobile;?>" maxlength="10" style="display:none;">
							<span class="editAlert" id="editMobileAlert"><b>！</b>格式錯誤</span>
						</div>
						<div class="detailItem" id="memberGender">
							<span class="itemTitle">性別</span>
							<span id="memberGenderDisplay"><?php echo $memberGender;?></span>
							<div id="memberGenderInputArea" style="display:none;">
								男性：<input type="radio" name="memberGenderInput" value="1" <?php echo $gender1Check;?>>
								女性：<input type="radio" name="memberGenderInput" value="2" <?php echo $gender2Check;?>>
							</div>
						</div>
						<div class="detailItem" id="memberBirthday">
							<span class="itemTitle">生日</span>
							<span id="memberBirthdayDisplay"><?php echo $memberBirthday;?></span>
							<div id="memberBirthdayInputArea" style="display:none;">
								西元 <select id="memberBirthdayYearInput" name="memberBirthdayYearInput">
									<?php echo $memberBirthdayYearStr;?>
								</select> 年 
								<select id="memberBirthdayMonthInput" name="memberBirthdayMonthInput"> 
									<?php echo $memberBirthdayMonthStr;?>
								</select> 月 
								<select id="memberBirthdayDayInput" name="memberBirthdayDayInput">
									<?php echo $memberBirthdayDayStr;?>
								</select> 日
							</div>
							<span class="editAlert" id="editBirthdayAlert"><b>！</b>格式錯誤</span>
						</div>
						<div class="detailItem" id="memberLocation">
							<span class="itemTitle">地區</span>
							<span id="memberLocationDisplay"><?php echo $memberLocation;?></span>
							<div id="memberLocationInputArea" style="display:none;">
								<select id="regionInput" name="regionInput">
									<?php echo $regionHTML;?>
								</select>
								<select id="sectionInput" name="sectionInput">
									<option value="" selected="selected">請選擇縣市</option>
									<?php echo $sectionHTML;?>
								</select>
							</div>
						</div>
						<div class="detailItem" id="memberEmail">
							<span class="itemTitle">電子信箱</span>
							<?php echo $memberEmail;?>
						</div>
						<div class="detailItem" id="editAction">
							<button type="button" class="btn btn-primary" id="detailSubmit">儲存</button>
							<button type="button" class="btn btn-default" id="detailCancel">取消</button>
						</div>
					</div>
					<div class="col-xs-12 col-sm-6 memberDetailRight">
						<div class="detailItem" id="memberIntro">
							<span class="itemTitle">簡介</span>
						</div>
						<div class="detailItem" id="memberIntroArea">
							<span id="memberDescriptionDisplay"><?php echo $memberDescription;?></span>
							<textarea id="memberDescriptionInput" name="memberDescriptionInput" style="display:none;"><?php echo $memberDescriptionTextarea;?></textarea>
						</div>
					</div>
				</div>
				
				<a href="javascript:void(0);" title="目前狀態" id="statusHelp">現在想做些什麼呢？</a>
				<div class="memberStatus">
					<div class="col-xs-6 chooseStatusLeft">
						<input type="hidden" id="statusID" name="statusID" value="<?php echo $statusID;?>">
						<div class="btn-group">
							<button type="button" id="statusNow" class="btn btn-lg btn-default btn-block dropdown-toggle" data-toggle="dropdown">
								<?php echo $statusCurrent;?> <span class="caret"></span>
							</button>
							<ul class="dropdown-menu" role="menu">
								<?php echo $statusOption;?>
							</ul>
						</div>
					</div>
					<div class="col-xs-6 chooseStatusRight">
						<button class="btn btn-lg btn-primary btn-block" type="button" name="statusSubmit" id="statusSubmit">立刻揪團！</button>
					</div>
				</div>
			</div>
		</div>
	</div>

<!-- 儲存成功 -->
<div class="modal fade" id="save_success" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
	<div class="modal-dialog">
		<div class="modal-content saveok_content">
			已儲存成功！<br />
			<button type="button" class="btn btn-default saveok_btn" data-dismiss="modal">關閉</button>
		</div><!-- /.modal-content -->
	</div><!-- /.modal-dialog -->
</div><!-- /.modal -->

<!-- 上傳頭像 -->
<div class="modal fade" id="upload_avater" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
	<div class="modal-dialog">
		<div class="modal-content">
			<form action="" method="POST" name="FileForm" enctype="multipart/form-data">
			<div class="modal-header">
				<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
				上傳大頭照 <span class="imgupload_subtext">(建議選擇 400x400 像素以上之照片)</span>
			</div>
			<div class="modal-body uploadcenter">
				<p>
				<input type="file" id="pic_upload" name="pic_upload" class="btn-upload" value="選擇照片">
				</p>
				<div id="uploading" style="display:none;"><img src="assets/img/backgrounds/uploading.gif"></div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-default" data-dismiss="modal">取消</button>
				<button type="button" class="btn btn-primary"  id="pic_submit" name="pic_submit">上傳</button>
			</div>
			</form>
		</div><!-- /.modal-content -->
	</div><!-- /.modal-dialog -->
</div><!-- /.modal -->

<!-- 編輯頭像 -->
<div class="modal fade" id="edit_avater" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
				編輯大頭照 <span class="imgupload_subtext">(請選擇顯示範圍)</span>
			</div>
			<div class="modal-body">
				<div class="imgeditarea"><img src="<?php echo $headPicSrc;?>" id="imageEdit"></div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-default" data-dismiss="modal">取消</button>
				<button type="button" class="btn btn-primary" id="position_save">儲存</button>
			</div>
		</div><!-- /.modal-content -->
	</div><!-- /.modal-dialog -->
</div><!-- /.modal -->

<script type="text/javascript" src="assets/js/common/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="assets/js/common/ajaxfileupload.js"></script>
<script type="text/javascript" src="assets/js/common/bootstrap.min.js"></script>
<script type="text/javascript" src="assets/js/common/jquery.Jcrop.min.js"></script>
<script type="text/javascript">var BASE = '<?php echo base_url();?>';</script>
<script type="text/javascript" src="assets/js/meet/member.js"></script>
<script type="text/javascript">
$(document).ready(function(){
<?php echo $autoEditShow;?>
<?php echo $tutorial;?>
});
</script>
</body> 
</html>