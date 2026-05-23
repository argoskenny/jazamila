$('.close').bind('click',function()
{
	$('.alert').hide(100);    
});

// 登入
function login(){
	var id	 = $('#admin_id').val();
	var pass = $('#password').val();
	
	// 儲存餐廳資料
	$.ajax({
		type:'POST',
		url:'ajax/login',
		dataType:'json',
		data:{	id:id,
				pass:pass
				},
		success:function(data)
		{
			if(data['status'] == 'success')
			{
				location.href = 'admin';
			}
			else
			{
				// 帳密錯誤
				$('.alert').show(100);
			}
		},
		error:function()
		{
			alert("傳送失敗！");
		}
	});
}

// 清空欄位
$('#cancel').bind('click',function()
{
	 location.reload();    
});

// 地區選單
$('#res_region').change(function()
{
	if( $(this).val() == '' )
	{
		return false;
	}
	
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

// 新增、編輯餐廳資料表單驗證
function checkForm()
{
	var checkStr = '';
	if(!checking('res_name','1')){checkStr += 'res_name ';}
	if(!checking('res_region',"2")){checkStr += 'res_region ';}
	if(!checking('res_address',"3")){checkStr += 'res_address ';}
	if(!checking('res_foodtype',"4")){checkStr += 'res_foodtype ';}
	
	if(checkStr != '')
	{
		var tempStr = checkStr.split(' ');
		$('#' + tempStr[0]).focus();
		return false;
	}
	else
	{
		document.form_res_newdata.submit();
	}
}

// 審核分享餐廳資料 驗證 通過 不通過
function checkPostForm(pass)
{
	var checkStr = '';
	if(!checking('res_name','1')){checkStr += 'res_name ';}
	if(!checking('res_region',"2")){checkStr += 'res_region ';}
	if(!checking('res_address',"3")){checkStr += 'res_address ';}
	if(!checking('res_foodtype',"4")){checkStr += 'res_foodtype ';}
	
	if(checkStr != '')
	{
		var tempStr = checkStr.split(' ');
		$('#' + tempStr[0]).focus();
		return false;
	}
	else
	{
		$('#send_status').val(pass);
		document.form_post_review.submit();
	}
}

// 驗證詳細
function checking(name,msg)
{
	switch(name){
		case 'res_name':
			if($('#'+ name).val() == '')
			{
				$('#msg'+msg).show();
				return false;
			} 
			else
			{
				$('#msg'+msg).hide();
				return true;
			}  
		break;
		case 'res_region':
			if($('#'+ name).val() == '')
			{
				$('#msg'+msg).show();
				return false;
			}else
			{
				$('#msg'+msg).hide();
				return true;
			}
		break;
		case 'res_address':
			if ($('#'+name).val() == '')
			{
				$('#msg'+msg).show();
				return false;
			}
			else
			{
				$('#msg'+msg).hide();
				return true;
			}
		break;
		case 'res_foodtype':
			if ($('#'+ name).val() == '')
			{
				$('#msg'+msg).show();
				return false;
			}
			else
			{
				$('#msg'+msg).hide();
				return true;
			}
		break;
	}
}
$('#blog_show').bind('change',function()
{
	 document.switch_list.submit();   
});
// 食記通過審核
function pass_blog(blog_id)
{
	var querySting = {blog_id:blog_id};
	$.ajax({
		type:	"POST",
		url:	'ajax/pass_blog',
		data:	querySting,
		success:function(data)
		{
			location.reload();
		}
	});
}

// 食記不通過審核
function unpass_blog(blog_id)
{
	var querySting = {blog_id:blog_id};
	$.ajax({
		type:	"POST",
		url:	'ajax/unpass_blog',
		data:	querySting,
		success:function(data)
		{
			location.reload();
		}
	});
}

// 食記編輯
function edit_blog(blog_id)
{
	// 編輯模式按紐切換
	$('#btn_pass_'+blog_id).hide();
	$('#btn_unpass_'+blog_id).hide();
	$('#btn_edit_'+blog_id).hide();
	$('#btn_fix_'+blog_id).show();
	$('#btn_cancel_'+blog_id).show();
	
	$('#name_show_'+blog_id).hide();
	$('#url_show_'+blog_id).hide();
	$('#name_edit_'+blog_id).show();
	$('#url_edit_'+blog_id).show();
}

// 食記編輯儲存
function fix_blog(blog_id)
{
	$('#msg_'+blog_id).hide();
	var fix_blogname = $('#b_blogname_'+blog_id).val();
	var fix_bloglink = $('#b_bloglink_'+blog_id).val();
	if(fix_blogname=='' || fix_bloglink=='')
	{
		$('#msg_'+blog_id).show();
		return false;
	}
	var querySting = {blog_id:blog_id,fix_blogname:fix_blogname,fix_bloglink:fix_bloglink};
	$.ajax({
		type:	"POST",
		url:	'ajax/fix_blog',
		data:	querySting,
		success:function(data)
		{
			$('#name_show_'+blog_id).html('<a href="'+fix_bloglink+'" target="_blank">'+fix_blogname+'</a>');
			$('#url_show_'+blog_id).html('URL：'+fix_bloglink);	
			cancel_blog(blog_id);
		}
	});
}

// 食記編輯取消
function cancel_blog(blog_id)
{
	$('#msg_'+blog_id).hide();
	// 編輯模式按紐切換
	$('#btn_pass_'+blog_id).show();
	$('#btn_unpass_'+blog_id).show();
	$('#btn_edit_'+blog_id).show();
	$('#btn_fix_'+blog_id).hide();
	$('#btn_cancel_'+blog_id).hide();
	
	$('#name_show_'+blog_id).show();
	$('#url_show_'+blog_id).show();
	$('#name_edit_'+blog_id).hide();
	$('#url_edit_'+blog_id).hide();
}