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
    setStatus(data.status === "success" ? "已送出，待後台審核。" : "送出失敗，請確認網址。");
    setIsSubmitting(false);
    if (data.status === "success") event.currentTarget.reset();
  }

  return (
    <form className="panel form-grid" onSubmit={onSubmit}>
      <h2>分享食記</h2>
      <label className="field">
        <span>食記名稱</span>
        <input className="input" name="res_blogname" required />
      </label>
      <label className="field">
        <span>網址</span>
        <input className="input" name="res_bloglink" type="url" required />
      </label>
      <button className="button secondary" type="submit" disabled={isSubmitting}>
        送出食記
      </button>
      {status ? <p className="status">{status}</p> : null}
    </form>
  );
}
