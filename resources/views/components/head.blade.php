<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport"
        content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0" />

    <meta name="author" content="JAZAMILA" />
    <meta name="dcterms.rightsHolder" content="jazamila.com" />
    <meta name="description" content="{{ $description ?? 'JAZAMILA內有許多美食、餐廳的資料，幫你解決不知該吃哪間餐廳的煩惱。' }}" />
    <meta name="robots" content="all" />
    <meta name="googlebot" content="all" />

    <title>{{ $title ?? 'JAZAMILA' }}</title>
    <base href="{{ url('/') }}/" />

    <link rel="shortcut icon" href="{{ asset('assets/img/jazamila/logo/jazamila.ico') }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="{{ asset('assets/css/jazamila/header_footer.css') }}" rel="stylesheet" type="text/css" />
    @if (isset($additional_css))
        @foreach ($additional_css as $css)
            <link href="{{ asset($css) }}" rel="stylesheet" type="text/css" />
        @endforeach
    @endif
    <link href="{{ asset('assets/css/theme.css') }}" rel="stylesheet" type="text/css" />
</head>
