
var circle_btn_flag	= false; // 餐廳條件是否開啟指標
var not_found_flag	= false; // 找不到餐廳視窗是否開啟指標

$(document).ready(function()
{
	$('.circle_btn').click(function(){
		// 選項動畫
		$('#option_choose').animate({
			height:		'toggle',
			opacity:	'toggle'
		},250);
		
		// 按鈕旋轉動畫
		if(circle_btn_flag == true)
		{
			rotate_circle_btn(0);
			circle_btn_flag = false;
		}
		else
		{
			rotate_circle_btn(45);
			circle_btn_flag = true;
		}
	});
	
	// 起始選項
	if( $('#foodwhere_region').val() != '' )
	{
		var select_area = {regionid:$('#foodwhere_region').val()};
		$.ajax({
			type:	"POST",
			url:	'jazamila_ajax/get_section_cookie',
			data:	select_area,
			success:function(data)
			{
				data = '<option value="0">全區</option>' + data;
				$('#foodwhere_section').html(data);
			}
		});
	}
});

// 按鈕旋轉動畫
function rotate_circle_btn(deg)
{
	$('.circle_btn').animate(
		{rotate:deg},
		{
			step: function(now,fx){
				$(this).css('-webkit-transform','rotate('+now+'deg)');
				$(this).css('-moz-transform','rotate('+now+'deg)'); 
				$(this).css('-ms-transform','rotate('+now+'deg)');
				$(this).css('-o-transform','rotate('+now+'deg)');
				$(this).css('transform','rotate('+now+'deg)'); 
			},duration:250
		},250
	);
	return;
}

// 地區選單
$('#foodwhere_region').change(function()
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
			data = '<option value="0" selected="selected">全區</option>' + data;
			$('#foodwhere_section').html(data);
		}
	});
});

// 顯示找不到餐廳視窗
function show_not_found(circle_btn_flag)
{
	if(not_found_flag == true && circle_btn_flag == true)
	{
		$('.not_found').animate({
			height:		'toggle',
			opacity:	'toggle'
		},250);
		
		$('.not_found').animate({
			height:		'toggle',
			opacity:	'toggle'
		},250);
	}
	else
	{
		$('.not_found').animate({
			height:		'show',
			opacity:	'show'
		},250);
		not_found_flag = true;
	}
}

// 隨機選餐廳
function pick()
{
	var foodwhere_region	= $('#foodwhere_region').val();
	var foodwhere_section	= $('#foodwhere_section').val();
	var foodmoney_max		= $('#foodmoney_max').val();
	var foodmoney_min		= $('#foodmoney_min').val();
	var foodtype		= $('#foodtype').val();
	if( $('#remember_box').prop('checked') == true)
	{
		var remember = 1;
	}
	else
	{
		var remember = 0;
	}
	// 儲存餐廳資料
	$.ajax({
		type:'POST',
		url:'jazamila_ajax/pick',
		dataType:'json',
		data:{	foodwhere_region:foodwhere_region,
				foodwhere_section:foodwhere_section,
				foodmoney_max:foodmoney_max,
				foodmoney_min:foodmoney_min,
				foodtype:foodtype,
				remember:remember
				},
		success:function(data)
		{
			if(data['status'] == 'success')
			{
				
				if(data['res_id'] == 0)
				{
					// 選項開啟判定
					if(circle_btn_flag == false)
					{
						$('#option_choose').animate({
							height:		'toggle',
							opacity:	'toggle'
						},250);
						
						rotate_circle_btn(45);
						show_not_found(circle_btn_flag);
						
						circle_btn_flag = true;
					}
					else
					{
						show_not_found(circle_btn_flag);
					}
				}
				else
				{
					location.href = 'detail/'+data['res_id']+'?option='+foodwhere_region+'XX'+foodwhere_section+'XX'+foodmoney_max+'XX'+foodmoney_min+'XX'+foodtype;
				}
			}
			else
			{
				alert('等等...好像有哪邊錯了...');
			}
		},
		error:function()
		{
			alert("等等...怪怪的喔..");
		}
	});
}

// 捲動到最上面
function gotop()
{
	$("html,body").animate({scrollTop:0},900);
}