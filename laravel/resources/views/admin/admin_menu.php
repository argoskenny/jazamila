<div class="navbar navbar-default">

	<div class="navbar-header">
		<button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
		</button>
		<a class="navbar-brand" href="admin">JAZAMILA 後台管理</a>
	</div>
	
	<div class="navbar-collapse collapse">
		<ul class="nav navbar-nav">
			<li class="dropdown">
				<a href="" class="dropdown-toggle" data-toggle="dropdown">餐廳資料管理<b class="caret"></b></a>
				<ul class="dropdown-menu">
					<li class="dropdown-header">餐廳資料</li>
					<li><a href="admin/res_list/1">餐廳列表</a></li>
					<li><a href="admin/res_insert">新增餐廳</a></li>
					<li class="divider"></li>
					<li class="dropdown-header">餐廳分享</li>
					<li><a href="admin/post_unreview/1">尚未審核列表</a></li>
					<li><a href="admin/post_passed/1">通過審核列表</a></li>
					<li><a href="admin/post_unpass/1">不通過審核列表</a></li>
				</ul>
			</li>
			<li class="dropdown">
				<a href="" class="dropdown-toggle" data-toggle="dropdown">食記連結管理<b class="caret"></b></a>
				<ul class="dropdown-menu">
					<li><a href="admin/blog_unreview/1">食記列表</a></li>
				</ul>
			</li>
			<li class="dropdown">
				<a href="" class="dropdown-toggle" data-toggle="dropdown">推薦餐廳管理<b class="caret"></b></a>
				<ul class="dropdown-menu">
					<li><a href="admin/associate_list/1">已選列表</a></li>
					<li><a href="admin/associate_edit">編輯關連餐廳</a></li>
				</ul>
			</li>
			<li class="dropdown">
				<a href="" class="dropdown-toggle" data-toggle="dropdown">問題建議管理<b class="caret"></b></a>
				<ul class="dropdown-menu">
					<li><a href="admin/feedback_list/1">問題建議列表</a></li>
				</ul>
			</li>
		</ul>
		<ul class="nav navbar-nav navbar-right">
			<li ><a href="admin/logout">登出</a></li>
		</ul>
	</div>
	
</div>