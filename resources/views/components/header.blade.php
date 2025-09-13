<nav class="navbar navbar-expand-lg navbar-light bg-light header">
    <div class="container">
        <a class="navbar-brand" href="{{ url('/') }}">
            <img src="{{ asset('assets/img/jazamila/logo/jazamila_logo.png') }}" alt="JAZAMILA logo">
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar"
            aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="mainNavbar">
            <ul class="navbar-nav ms-auto">
                <li class="nav-item">
                    <a class="nav-link {{ (isset($active_nav) && $active_nav === 'home') || request()->is('/') ? 'active' : '' }}"
                        href="{{ url('/') }}">首頁</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link {{ (isset($active_nav) && $active_nav === 'listdata') || request()->is('listdata*') ? 'active' : '' }}"
                        href="{{ url('listdata/0/0/0/0/1') }}">餐廳列表</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link {{ (isset($active_nav) && $active_nav === 'about') || request()->is('about') ? 'active' : '' }}"
                        href="{{ url('about') }}">關於本站</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link {{ (isset($active_nav) && $active_nav === 'post') || request()->is('post') ? 'active' : '' }}"
                        href="{{ url('post') }}">餐廳分享</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link {{ (isset($active_nav) && $active_nav === 'map') || request()->is('map') ? 'active' : '' }}"
                        href="{{ url('map') }}">美食地圖</a>
                </li>
            </ul>
        </div>
    </div>
</nav>
