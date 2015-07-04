$(document).ready(function()
{
	
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

// 表單檢查
$('#go_submit').click(function(){
	var saved = false;
	var checkStr = '';
	if(!checking('guestbook_name','name')){checkStr += 'guestbook_name ';}
	if(!checking('guestbook_content','content')){checkStr += 'guestbook_content ';}
	if(!checking('captcha','captcha')){checkStr += 'captcha ';}
	
	if( checkStr != '' )
	{
		var tempStr = checkStr.split(" ");
		$('#'+tempStr[0]).focus();
		return false;
	}
	
	// 驗證碼檢查
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
});
function saving_feedback(name,email,content)
{
	var querySting = {name:name,email:email,content:content};
	$.ajax({
		type:	"POST",
		url:	'jazamila_ajax/save_feedback_post',
		data:	querySting,
		success:function(data)
		{
			if(data == 'success')
			{
				$('#feedback_form').animate({
					height:		'hide',
					opacity:	'hide'
				},500);
				
				$('.thank_feedback').animate({
					height:		'show',
					opacity:	'show'
				},1000);
			}
			else
			{
				alert('儲存失敗');
			}
		}
	});
}

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