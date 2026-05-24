"use client";

import { useState } from "react";

export function FeedbackForm() {
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    const response = await fetch("/jazamila_ajax/save_feedback_post", {
      method: "POST",
      body: new FormData(event.currentTarget)
    });
    const text = await response.text();
    setStatus(text === "success" ? "已送出你的問題或建議，感謝你。" : "送出失敗，請稍後再試。");
    setIsSubmitting(false);
    if (text === "success") event.currentTarget.reset();
  }

  return (
    <form className="panel form-grid" onSubmit={onSubmit}>
      <h2>如有任何問題或建議，歡迎與我聯繫</h2>
      <label className="field">
        <span>姓名 *</span>
        <input className="input" name="name" placeholder="請輸入大名" required />
      </label>
      <label className="field">
        <span>電子郵件</span>
        <input className="input" name="email" placeholder="請輸入電子郵件信箱" type="email" required />
      </label>
      <label className="field">
        <span>問題或建議 *</span>
        <textarea className="textarea" name="content" placeholder="請輸入內容" required />
      </label>
      <button className="button secondary" type="submit" disabled={isSubmitting}>
        確定送出
      </button>
      {status ? <p className="status" role="status">{status}</p> : null}
    </form>
  );
}
