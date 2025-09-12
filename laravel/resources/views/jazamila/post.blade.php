<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />
	
	<meta name="author" content="JAZAMILA" />
	<meta name="dcterms.rightsHolder" content="jazamila.com" />
	<meta name="description" content="JAZAMILA網站介紹。" />
	<meta name="robots" content="all" />
	<meta name="googlebot" content="all" />
	
	<title>{{ $title }}</title>
        <base href="{{ url('/') }}/"/>

        <link rel="shortcut icon" href="{{ asset('assets/img/jazamila/logo/jazamila.ico') }}" >
        <link href="{{ asset('assets/css/common/bootstrap.min.css') }}" rel="stylesheet" type="text/css" />
        <link href="{{ asset('assets/css/jazamila/header_footer.css') }}" rel="stylesheet" type="text/css" />
        <link href="{{ asset('assets/css/jazamila/post.css') }}" rel="stylesheet" type="text/css" />

	<script src='https://www.google.com/recaptcha/api.js'></script>
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
				<li><a href="about">關於本站</a></li>
				<li class="active"><a href="post">餐廳分享</a></li>
				</ul>
			</div>
		</div>
	</div>
	
	<div class="main">
		<div class="container">
			<a name="feedback_anchor"></a>
			<div class="main_title">餐廳分享</div>
			<div class="main_text">有好吃的？請推薦給大家吧！</div>
			<form id="post_form" name="post_form" action="save_post_data" method="post" enctype="multipart/form-data" role="form">
				<div class="form-group">
					<label for="name">餐廳名稱 *</label>
					<input type="text" class="form-control" id="res_name" name="res_name" placeholder="請輸入餐廳名稱">
					<div class="msg" id="msg_name">請輸入餐廳名稱</div>
				</div>
				<div class="form-group">
					<label for="phone">餐廳電話</label><br />
					<input type="text" class="form-control" id="res_area_num" name="res_area_num" maxlength="3" value="" > - <input type="text" class="form-control" name="res_tel_num" id="res_tel_num" maxlength="8" value="" >
				</div>
				<div class="form-group">
					<label for="content">餐廳地址 *</label><br />
					<select class="form-control" id="res_region" name="res_region">
						<option value='' selected="selected">請選擇</option>
							<?php
							foreach($config['regionid'] as $key => $val){
								echo "<option value='".$key."'>".$val."</option>";
							}
							?>
					</select>
					<select class="form-control" id="res_section" name="res_section">
						<option value='' selected="selected">請選擇縣市</option>
					</select>
					<input type="text" class="form-control" id="res_address" name="res_address" placeholder="請輸入餐廳地址">
					<div class="msg" id="msg_address">請輸入完整餐廳地址</div>
				</div>
				<div class="form-group">
					<label for="content">美食類別 *</label>
					<select class="form-control" id="res_foodtype" name="res_foodtype">
					<option value='' selected="selected">請選擇</option>
						<?php
							foreach($config['foodtype'] as $key => $val){
								echo "<option value='".$key."'>".$val."</option>";
							}
						?>
					</select>
					<div class="msg" id="msg_foodtype">請選擇美食類別</div>
				</div>
				<div class="form-group">
					<label for="content">平均價位</label>
					<select class="form-control" id="res_price" name="res_price">
						<option value='' selected="selected">請選擇</option>
						<option value='100'>100元左右</option>
						<option value='200'>200元左右</option>
						<option value='300'>300元左右</option>
						<option value='400'>400元左右</option>
						<option value='500'>500元左右</option>
						<option value='600'>600元左右</option>
						<option value='700'>700元左右</option>
						<option value='800'>800元左右</option>
						<option value='900'>900元左右</option>
						<option value='1000'>1000元左右</option>
						<option value='1100'>1000元以上</option>
					</select>
					<div class="msg" id="msg_price">請輸入平均價位</div>
				</div>
				<div class="form-group">
					<label for="content">營業時間</label><br />
					<input type="text" class="form-control res_time" name="open_time_hr" id="open_time_hr" maxlength="2" value=""/> ：
					<input type="text" class="form-control res_time" name="open_time_min" id="open_time_min" maxlength="2" value=""/>
					至 <input type="text" class="form-control res_time" name="close_time_hr" id="close_time_hr" maxlength="2" value=""/> ：
					<input type="text" class="form-control res_time" name="close_time_min" id="close_time_min" maxlength="2" value=""/>
				</div>
				<div class="form-group">
					<label for="content">餐廳介紹</label>
					<textarea class="form-control" rows="8" id="res_note" name="res_note" placeholder="請輸入餐廳介紹"></textarea>
				</div>
				<div class="form-group">
					<label for="label_res_note">照片上傳</label>
					<input type="file" name="img_url" id="img_url"/>
				</div>
				<div class="form-group">
					<label for="content">食記分享</label><span style="color:#666;">（最多四個）</span>
					<input type="text" class="form-control blogname" id="res_blogname1" name="res_blogname1" onfocus="if(this.value=='請輸入食記名稱'){this.value=''; $(this).css('color','black');}" onblur="if(this.value==''){this.value='請輸入食記名稱'; $(this).css('color','#999');}" value="請輸入食記名稱" alt="請輸入食記名稱">
					<input type="text" class="form-control bloglink" id="res_bloglink1" name="res_bloglink1" onfocus="if(this.value=='請輸入食記網址'){this.value=''; $(this).css('color','black');}" onblur="if(this.value==''){this.value='請輸入食記網址'; $(this).css('color','#999');}" value="請輸入食記網址" alt="請輸入食記網址">
					<input type="text" class="form-control blogname hiding" id="res_blogname2" name="res_blogname2" onfocus="if(this.value=='請輸入食記名稱'){this.value=''; $(this).css('color','black');}" onblur="if(this.value==''){this.value='請輸入食記名稱'; $(this).css('color','#999');}" value="請輸入食記名稱" alt="請輸入食記名稱">
					<input type="text" class="form-control bloglink hiding" id="res_bloglink2" name="res_bloglink2" onfocus="if(this.value=='請輸入食記網址'){this.value=''; $(this).css('color','black');}" onblur="if(this.value==''){this.value='請輸入食記網址'; $(this).css('color','#999');}" value="請輸入食記網址" alt="請輸入食記網址">
					<input type="text" class="form-control blogname hiding" id="res_blogname3" name="res_blogname3" onfocus="if(this.value=='請輸入食記名稱'){this.value=''; $(this).css('color','black');}" onblur="if(this.value==''){this.value='請輸入食記名稱'; $(this).css('color','#999');}" value="請輸入食記名稱" alt="請輸入食記名稱">
					<input type="text" class="form-control bloglink hiding" id="res_bloglink3" name="res_bloglink3" onfocus="if(this.value=='請輸入食記網址'){this.value=''; $(this).css('color','black');}" onblur="if(this.value==''){this.value='請輸入食記網址'; $(this).css('color','#999');}" value="請輸入食記網址" alt="請輸入食記網址">
					<input type="text" class="form-control blogname hiding" id="res_blogname4" name="res_blogname4" onfocus="if(this.value=='請輸入食記名稱'){this.value=''; $(this).css('color','black');}" onblur="if(this.value==''){this.value='請輸入食記名稱'; $(this).css('color','#999');}" value="請輸入食記名稱" alt="請輸入食記名稱">
					<input type="text" class="form-control bloglink hiding" id="res_bloglink4" name="res_bloglink4" onfocus="if(this.value=='請輸入食記網址'){this.value=''; $(this).css('color','black');}" onblur="if(this.value==''){this.value='請輸入食記網址'; $(this).css('color','#999');}" value="請輸入食記網址" alt="請輸入食記網址">
					<span id="add_blog" class="blog_adjust">+</span>
				</div>
				<div class="form-group">
					<label for="captcha">驗證碼 *</label><br />
					<!--
					<img src="CaptchaImg" name="IM1" id="IM1" onclick="IMCHEN();return false;" alt="" title="看不清楚？按我變換圖片" />
					<input type="text" class="form-control" id="captcha" name="captcha" maxlength="4">
					<div class="msg" id="msg_captcha">請輸入驗證碼</div>
					<div class="msg" id="msg_captcha_error">驗證碼錯誤</div>
					-->
					<div class="g-recaptcha" data-sitekey="6LdH9gATAAAAAIGxel7yPewJbIhC5xwUA0ZUJAgz"></div>
				</div>
				<div class="form_submit">
					<button type="button" id="post_submit" data-loading-text="儲存中..." class="btn">確定送出</button>
				</div>
			</form>
		</div>
	</div>
	
	<div class="share">
		<div class="container">
			<div class="faq_title">餐廳分享說明</div>
			<div class="faq_q">Q1. 餐廳分享？這是在幹嘛？</div>
			<div class="faq_a">A1. 這裡是為了讓你分享餐廳資訊用的。</div>
			<div class="faq_q">Q2. 怎麼分享？</div>
			<div class="faq_a">A2. 在上面輸入餐廳資訊，欄位旁有加 * 號的代表必填。</div>
			<div class="faq_q">Q3. 新增成功後，就能在餐廳列表中，找到我剛剛分享的餐廳了嗎？</div>
			<div class="faq_a">A3. 需要稍等一段時間，我會盡快處理。</div>
			<div class="faq_q">Q4. 為什麼我要分享？有什麼好處？</div>
			<div class="faq_a">A4. 相信你一定有注意到，這裡的餐廳資料有點少。你的分享將會豐富這裡的餐廳資訊，並解決更多人不知道要吃什麼的窘境。而在餐廳的介紹頁面，可以放上你個人部落格的食記連結，介紹這家餐廳。當然，如果沒有部落格也可以分享。</div>
			<div class="faq_q">Q5. 我輸入的餐廳資料好像網站裡面已經有了？怎麼辦？</div>
			<div class="faq_a">A5. 沒有關係，我會幫你過濾掉。</div>
			<div class="faq_q">Q6. 網站上已經有某某餐廳的資料了，但我想分享新的食記連結？怎麼辦？</div>
			<div class="faq_a">A6. 你可以在那間餐廳的詳細資訊頁面中新增連結。一樣的，會需要一點時間才會加上去。</div>
			<div class="faq_q">Q7. 分享的餐廳類型有限制嗎？我可以分享麥當勞嗎？</div>
			<div class="faq_a">A7. 沒有。只要你覺得好吃，就可以分享。如果你覺得麥當勞好吃的話，當然可以。</div>
			<div class="faq_q">Q8. 有人盜用我的部落格連結！</div>
			<div class="faq_a">A8. 趕快到<a href="about#feedback_anchor">這邊</a>來告訴我！記得請註明詳細事件經過和聯絡資料（Email即可）。</div>
		</div>
	</div>
	
	<div class="footer">
		<div class="container">
			<div class="col-xs-10 col-md-11">2013 JAZAMILA</div>
			<div class="col-xs-2 col-md-1"><a href="javascript:void(0)" onclick="gotop();">TOP</a></div>
		</div>
	</div>

	<div class="modal fade" id="save_success" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				已儲存成功，感謝你的分享！<br />
				<button type="button" class="btn btn-default" data-dismiss="modal">關閉</button>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div><!-- /.modal -->
	<input type="hidden" id="save_status" name="save_status" value="{{ $save }}">
	
<script type="text/javascript" src="{{ asset('assets/js/common/jquery-1.10.2.min.js') }}"></script>
<script type="text/javascript" src="{{ asset('assets/js/common/bootstrap.min.js') }}"></script>
<script type="text/javascript">var BASE = '{{ url('/') }}';</script>
<script type="text/javascript" src="{{ asset('assets/js/jazamila/post.js') }}"></script>
</body>
</html>