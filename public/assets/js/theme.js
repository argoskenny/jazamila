// Theme enhancements: smooth scroll + reveal on scroll
(function () {
  // Early exit if jQuery missing
  if (typeof window.jQuery === 'undefined') return;
  var $ = window.jQuery;

  $(function () {
    // If arriving with a hash, scroll to it smoothly after layout
    if (window.location.hash) {
      var id = window.location.hash.replace(/^#/, '');
      var $target = $('#' + id + ', a[name="' + id + '"]');
      if ($target.length) {
        setTimeout(function(){
          var headerOffset = 68;
          var top = $target.offset().top - headerOffset;
          $('html, body').stop().animate({ scrollTop: Math.max(top, 0) }, 600);
        }, 100);
      }
    }
    // Smooth scroll for in-page anchors
    $(document).on('click', 'a[href^="#"]', function (e) {
      var href = $(this).attr('href');
      // Ignore empty or just '#'
      if (!href || href === '#') return;
      var id = href.replace(/^#/, '');
      var $target = $('#' + id);
      if ($target.length) {
        e.preventDefault();
        var headerOffset = 68; // approx navbar height
        var top = $target.offset().top - headerOffset;
        $('html, body').stop().animate({ scrollTop: Math.max(top, 0) }, 600);
      }
    });

    // Reveal on scroll using IntersectionObserver if available
    var $reveals = $('.reveal');
    if ($reveals.length) {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              $(entry.target).addClass('is-visible');
              io.unobserve(entry.target);
            }
          });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
        $reveals.each(function (_, el) { io.observe(el); });
      } else {
        // Fallback: simple on-scroll check
        var revealCheck = function () {
          var scrollY = window.pageYOffset || document.documentElement.scrollTop;
          var vh = window.innerHeight || document.documentElement.clientHeight;
          $reveals.each(function (_, el) {
            var rect = el.getBoundingClientRect();
            var top = rect.top;
            if (top < vh * 0.9) $(el).addClass('is-visible');
          });
        };
        revealCheck();
        $(window).on('scroll', revealCheck);
      }
    }
  });
})();
