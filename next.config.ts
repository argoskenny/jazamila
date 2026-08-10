import type { NextConfig } from "next";

export function contentSecurityPolicy(environment = process.env.NODE_ENV): string {
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(environment === "development" ? ["'unsafe-eval'"] : []),
    "https://www.google.com/recaptcha/",
    "https://www.gstatic.com/recaptcha/"
  ];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://www.google.com/recaptcha/",
    "frame-src https://www.google.com/recaptcha/"
  ].join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy()
          }
        ]
      }
    ];
  },
  async rewrites() {
    return [
      { source: "/admin/res_list/:set", destination: "/admin/restaurants?set=:set" },
      { source: "/admin/res_detail/:id", destination: "/admin/restaurants/:id" },
      { source: "/admin/res_insert", destination: "/admin/restaurants/new" },
      { source: "/admin/res_edit/:id", destination: "/admin/restaurants/:id/edit" },
      { source: "/admin/post_unreview/:set", destination: "/admin/posts?status=0&set=:set" },
      { source: "/admin/post_passed/:set", destination: "/admin/posts?status=1&set=:set" },
      { source: "/admin/post_unpass/:set", destination: "/admin/posts?status=2&set=:set" },
      { source: "/admin/blog_unreview/:set", destination: "/admin/blogs?status=0&set=:set" },
      { source: "/admin/blog_passed/:set", destination: "/admin/blogs?status=1&set=:set" },
      { source: "/admin/blog_unpass/:set", destination: "/admin/blogs?status=2&set=:set" },
      { source: "/admin/feedback_list/:set", destination: "/admin/feedback?set=:set" }
    ];
  }
};

export default nextConfig;
