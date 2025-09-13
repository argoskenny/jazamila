$(document).ready(function()
{
	if( $('#save_status').val() == 1 )
	{
		$('#save_success').modal('show');
	}
	
	
});

// 捲動到最上面
function gotop()
{
	$("html,body").animate({scrollTop:0},900);
}

// 驗證碼重置
function IMCHEN() 
{
	document.getElementById('IM1').src='CaptchaImg?int='+Math.random();
	document.getElementById('IM1').alt='看不清楚？按我變換圖片';
}


// 地區選單
$('#res_region').change(function()
{
	if( $(this).val() == '' )
	{
		return false;
	}
	
	// 驗證碼檢查
	var querySting = {regionid:$(this).val()};
	$.ajax({
		type:	"POST",
		url:	'jazamila_ajax/get_section',
		data:	querySting,
		success:function(data)
		{
			$('#res_section').html(data);
		}
	});
});

// 食記網誌數量
var blog_num = 1;

// 食記網誌增減
$('#add_blog').click(function()
{
	if( blog_num < 4 )
	{
		var oBrowser = new detectBrowser();
		// 垃圾safari就是不work只好寫成這樣
		if (oBrowser.isSa && !oBrowser.isCh)
		{ 
			blog_num++;
			switch(blog_num)
			{
				case 2:
					$('#res_blogname2').css('display','block');
					$('#res_bloglink2').css('display','block');
				break;
				case 3:
					$('#res_blogname3').css('display','block');
					$('#res_bloglink3').css('display','block');
				break;
				case 4:
					$('#res_blogname4').css('display','block');
					$('#res_bloglink4').css('display','block');
				break;	
			}
		}
		else
		{
			blog_num++;
		
			$('#res_blogname'+blog_num).animate({
				height:		'show',
				opacity:	'show'
			},250);
			$('#res_bloglink'+blog_num).animate({
				height:		'show',
				opacity:	'show'
			},250);	
		}
		if( blog_num == 4 )
		{
			$(this).css('color','#999');
		}
	}
});

// 表單檢查
$('#post_submit').click(function()
{
	var saved = false;
	var checkStr = '';
	
	if(!checking('res_name','name')){checkStr += 'res_name ';}
	
	// 地址驗證
	if( $('#res_region').val() == '' || $('#res_section').val() == '' || $('#res_address').val() == '')
	{
		// 鎖定縣市或地址
		if( $('#res_region').val() == '' )
		{
			checkStr += 'res_region ';
		}
		else
		{
			checkStr += 'res_address ';
		}
		
		$('#msg_address').animate({
			height:		'show',
			opacity:	'show'
		},250);
	}
	else
	{
		$('#msg_address').animate({
			height:		'hide',
			opacity:	'hide'
		},250);
	}
	
	if(!checking('res_foodtype','foodtype')){checkStr += 'res_foodtype ';}
	//if(!checking('captcha','captcha')){checkStr += 'captcha ';}
	
	if( checkStr != '' )
	{
		var tempStr = checkStr.split(" ");
		$('#'+tempStr[0]).focus();
		return false;
	}
	
	// 驗證碼檢查
	/*
	var querySting = {captcha:$('#captcha').val()};
	$.ajax({
		type:	"POST",
		url:	'jazamila_ajax/check_captcha',
		data:	querySting,
		success:function(data)
		{
			if(data == 'success')
			{
				$('#msg_captcha_error').animate({
					height:		'hide',
					opacity:	'hide'
				},250);
				saving_feedback($('#guestbook_name').val(),$('#guestbook_email').val(),$('#guestbook_content').val());
			}
			else
			{
				$('#msg_captcha_error').animate({
					height:		'show',
					opacity:	'show'
				},250);
				return false;
			}
		}
	});
	*/
	document.post_form.submit();
});

// 驗證詳細
function checking(name,msg)
{
	if($('#'+ name).val() == '')
	{
		$('#msg_'+msg).animate({
			height:		'show',
			opacity:	'show'
		},250);
		return false;
	} 
	else
	{
		$('#msg_'+msg).animate({
			height:		'hide',
			opacity:	'hide'
		},250);
		return true;
	}
}

// 瀏覽器偵測
function detectBrowser(){
	var sAgent = navigator.userAgent.toLowerCase();
	this.isIE = (sAgent.indexOf("msie")!=-1); //IE6.0-7
	this.isFF = (sAgent.indexOf("firefox")!=-1);//firefox
	this.isSa = (sAgent.indexOf("safari")!=-1);//safari
	this.isOp = (sAgent.indexOf("opera")!=-1);//opera
	this.isNN = (sAgent.indexOf("netscape")!=-1);//netscape
	this.isCh = (sAgent.indexOf("chrome")!=-1);//chrome
	this.isMa = this.isIE;//marthon
	this.isOther = (!this.isIE && !this.isFF && !this.isSa && !this.isOp && !this.isNN && !this.isSa);//unknown Browser
}