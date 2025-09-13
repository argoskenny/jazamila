<nav class="navbar navbar-expand-lg navbar-light bg-light">
    <div class="container-fluid">
        <a class="navbar-brand" href="admin">JAZAMILA 後台管理</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#adminNavbar"
            aria-controls="adminNavbar" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="adminNavbar">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle" href="#" id="navRes" role="button"
                        data-bs-toggle="dropdown" aria-expanded="false">餐廳資料管理</a>
                    <ul class="dropdown-menu" aria-labelledby="navRes">
                        <li>
                            <h6 class="dropdown-header">餐廳資料</h6>
                        </li>
                        <li><a class="dropdown-item" href="admin/res_list/1">餐廳列表</a></li>
                        <li><a class="dropdown-item" href="admin/res_insert">新增餐廳</a></li>
                        <li>
                            <hr class="dropdown-divider">
                        </li>
                        <li>
                            <h6 class="dropdown-header">餐廳分享</h6>
                        </li>
                        <li><a class="dropdown-item" href="admin/post_unreview/1">尚未審核列表</a></li>
                        <li><a class="dropdown-item" href="admin/post_passed/1">通過審核列表</a></li>
                        <li><a class="dropdown-item" href="admin/post_unpass/1">不通過審核列表</a></li>
                    </ul>
                </li>
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle" href="#" id="navBlog" role="button"
                        data-bs-toggle="dropdown" aria-expanded="false">食記連結管理</a>
                    <ul class="dropdown-menu" aria-labelledby="navBlog">
                        <li><a class="dropdown-item" href="admin/blog_unreview/1">食記列表</a></li>
                    </ul>
                </li>
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle" href="#" id="navAssociate" role="button"
                        data-bs-toggle="dropdown" aria-expanded="false">推薦餐廳管理</a>
                    <ul class="dropdown-menu" aria-labelledby="navAssociate">
                        <li><a class="dropdown-item" href="admin/associate_list/1">已選列表</a></li>
                        <li><a class="dropdown-item" href="admin/associate_edit">編輯關連餐廳</a></li>
                    </ul>
                </li>
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle" href="#" id="navFeedback" role="button"
                        data-bs-toggle="dropdown" aria-expanded="false">問題建議管理</a>
                    <ul class="dropdown-menu" aria-labelledby="navFeedback">
                        <li><a class="dropdown-item" href="admin/feedback_list/1">問題建議列表</a></li>
                    </ul>
                </li>
            </ul>
            <ul class="navbar-nav ms-auto">
                <li class="nav-item"><a class="nav-link" href="admin/logout">登出</a></li>
            </ul>
        </div>
    </div>
</nav>
