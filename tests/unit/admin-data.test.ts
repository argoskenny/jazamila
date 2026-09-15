import { describe, expect, it } from "vitest";
import { countAdminDashboardStats, listRestaurantsForAdmin } from "@/lib/domain/admin";
import { listBlogLinksForAdmin } from "@/lib/domain/blogs";
import { listFeedbackForAdmin } from "@/lib/domain/feedback";
import { listPostsForAdmin } from "@/lib/domain/posts";

describe("admin data queries", () => {
  it("returns paginated restaurant rows and total count", async () => {
    const result = await listRestaurantsForAdmin({ page: 1, perPage: 2 });

    expect(result.restaurants).toHaveLength(2);
    expect(result.totalRows).toBeGreaterThan(result.restaurants.length);
    expect(result.totalPages).toBeGreaterThan(1);
  });

  it("counts dashboard stats without loading full row sets", async () => {
    const stats = await countAdminDashboardStats();

    expect(stats).toMatchObject({
      restaurants: 5,
      posts: 1,
      blogs: 2,
      feedback: 1
    });
  });

  it("paginates moderation queues with bounded page sizes", async () => {
    const [posts, blogs, feedback] = await Promise.all([
      listPostsForAdmin({ page: 1, perPage: 1 }),
      listBlogLinksForAdmin({ page: 1, perPage: 1 }),
      listFeedbackForAdmin({ page: 1, perPage: 1 })
    ]);

    expect(posts.posts).toHaveLength(1);
    expect(blogs.blogLinks).toHaveLength(1);
    expect(feedback.feedback).toHaveLength(1);
    expect(blogs.totalPages).toBe(2);
    expect(posts.perPage).toBe(1);
  });
});
