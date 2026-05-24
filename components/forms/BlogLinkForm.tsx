"use client";

import { useState } from "react";

export function BlogLinkForm({ restaurantId }: { restaurantId: number }) {
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    const formData = new FormData(event.currentTarget);
    formData.set("res_id", String(restaurantId));

    const response = await fetch("/jazamila_ajax/blog_save", {
      method: "POST",
      body: formData
    });
    const data = (await response.json()) as { status: string };
    setStatus(data.status === "success" ? "已儲存成功，感謝你的分享！" : "送出失敗，請確認網址。");
    setIsSubmitting(false);
    if (data.status === "success") event.currentTarget.reset();
  }

  return (
    <form className="panel form-grid" onSubmit={onSubmit}>
      <h2>新增食記</h2>
      <label className="field">
        <span>食記名稱</span>
        <input className="input" name="res_blogname" placeholder="請輸入食記名稱" required />
      </label>
      <label className="field">
        <span>食記網址</span>
        <input className="input" name="res_bloglink" placeholder="請輸入食記網址" type="url" required />
      </label>
      <button className="button secondary" type="submit" disabled={isSubmitting}>
        送出
      </button>
      {status ? <p className="status">{status}</p> : null}
    </form>
  );
}
