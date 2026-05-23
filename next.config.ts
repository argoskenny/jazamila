import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
