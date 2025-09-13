<script type="text/javascript" src="{{ asset('assets/js/common/jquery-3.7.1.min.js') }}"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script type="text/javascript">
    var BASE = '{{ url('/') }}';
</script>
@if (isset($additional_js))
    @foreach ($additional_js as $js)
        <script type="text/javascript" src="{{ asset($js) }}"></script>
    @endforeach
@endif
<script type="text/javascript" src="{{ asset('assets/js/theme.js') }}"></script>
