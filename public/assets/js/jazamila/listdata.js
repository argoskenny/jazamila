$(document).ready(function()
{
	// 關鍵字樣式修正
	if($('#search_keyword').val() != '請輸入關鍵字')
	{
		$('#search_keyword').css('color','black');
	}
	
	// 商圈選擇
	$('.foodwhere .dropdown-menu li a').click(function(){

		$('#show_option_where').html($(this).text()+' <span class="caret"></span>');
		$('.foodwhere').removeClass('open');
	});
	
	// 縣市地區已設定 子選項自動選取
	if( $('#foodwhere_region').val() != 0 )
	{
		section_show($('#foodwhere_region').val());
	}
	
	// 縣市地區類型選單
	$('.foodwhere_region .dropdown-menu li a').click(function(){
		$('#show_option_region').html($(this).text()+' <span class="caret"></span>');
		var foodwhere_region = $(this).attr('a_type');
		$('#foodwhere_region').val(foodwhere_region);
		$('.foodwhere_region').removeClass('open');
		section_show(foodwhere_region);
	});
	
	$('.foodwhere_region .dropdown-toggle').click(function(){
		if($('.share').height() < 1000)
		{
			$('.foodwhere_region .dropdown-menu').css('position','relative');
		}
		else
		{
			$('.foodwhere_region .dropdown-menu').css('position','absolute');
		}
	});
	
	$('.foodwhere_section .dropdown-toggle').click(function(){
		if($('.share').height() < 1000)
		{
			$('.foodwhere_section .dropdown-menu').css('position','relative');
		}
		else
		{
			$('.foodwhere_section .dropdown-menu').css('position','absolute');
		}
	});
	
	// 價位下限選單
	$('.foodmoney_min .dropdown-menu li a').click(function(){

		$('#show_option_min').html($(this).text()+' <span class="caret"></span>');
		if($(this).text() == '0元')
		{
			var foodmoney_min = $(this).text().replace('元','');
		}
		else
		{
			var foodmoney_min = $(this).text().replace('元左右','');
		}
		$('#foodmoney_min').val(foodmoney_min);
		$('.foodmoney_min').removeClass('open');
	});
	
	// 價位上限選單
	$('.foodmoney_max .dropdown-menu li a').click(function(){

		$('#show_option_max').html($(this).text()+' <span class="caret"></span>');
		if($(this).text() == '無上限')
		{
			var foodmoney_max = 0;
		}
		else
		{
			var foodmoney_max = $(this).text().replace('元左右','');
		}
		$('#foodmoney_max').val(foodmoney_max);
		$('.foodmoney_max').removeClass('open');
	});
	
	// 美食類型選單
	$('.foodtype .dropdown-menu li a').click(function(){
		$('#show_option_type').html($(this).text()+' <span class="caret"></span>');
		var foodtype = $(this).attr('a_type');
		$('#foodtype').val(foodtype);
		$('.foodtype').removeClass('open');
	});
	
	$('.foodtype .dropdown-toggle').click(function(){
		if($('.share').height() < 1000)
		{
			$('.foodtype .dropdown-menu').css('position','relative');
		}
		else
		{
			$('.foodtype .dropdown-menu').css('position','absolute');
		}
	});
});

// 地區選單顯示
function section_show(regionid)
{
	if( regionid == 0 )
	{
		return;
	}
	var querySting = {regionid:regionid};
	$.ajax({
		type:	"POST",
		url:	'jazamila_ajax/listdata_get_section',
		data:	querySting,
		success:function(data)
		{
			$('.foodwhere_section .dropdown-menu').html(data);
		}
	});
}

// 地區類型選單
function section_click(sectionid,section_title)
{
	$('#show_option_section').html(section_title+' <span class="caret"></span>');
	$('#foodwhere_section').val(sectionid);
	$('.foodwhere_section').removeClass('open');
}

// 條件列表
function list_submit()
{
	$('.money_error').animate({
		height:		'hide',
		opacity:	'hide'
	},250);
	
	var region		= $('#foodwhere_region').val();
	var section		= $('#foodwhere_section').val();
	var location	= region+'X'+section;
	var min_money	= $('#foodmoney_min').val();
	var max_money	= $('#foodmoney_max').val();
	var foodtype	= $('#foodtype').val();
	var keyword		= '';
	
	if(max_money != 0)
	{
		if(min_money > max_money)
		{
			$('.money_error').animate({
				height:		'show',
				opacity:	'show'
			},250);
			
			var erreo_styles = {
				borderStyle:'solid',
				borderColor:'#FDB0A8'
			};
			$('#foodmoney_min').css(erreo_styles);
			$('#foodmoney_max').css(erreo_styles);
			$('#list_search_btn').css('background','#F97062');
			return;
		}
	}
	if($('#search_keyword').val() != '')
	{
		if($('#search_keyword').val() != '請輸入關鍵字')
		{
			keyword = '?search_keyword='+$('#search_keyword').val();
		}
	}
	if( region == 0 && section == 0 )
	{
		location = 0;
	}
	window.location =  document.getElementsByTagName("base")[0].getAttribute("href")+'listdata/'+location+'/'+foodtype+'/'+max_money+'/'+min_money+'/1'+keyword;
}

// 關鍵字搜尋
function keyword_submit()
{
	if($('#search_keyword').val() == '' || $('#search_keyword').val() == '請輸入關鍵字')
	{
		$('#search_keyword').val('');
		location.reload();
	}
	else
	{
		document.form_keyword.submit();
	}
}

// 捲動到最上面
function gotop()
{
	$("html,body").animate({scrollTop:0},900);
}