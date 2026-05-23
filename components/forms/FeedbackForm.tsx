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
    setStatus(text === "success" ? "已收到，謝謝你。" : "送出失敗，請稍後再試。");
    setIsSubmitting(false);
    if (text === "success") event.currentTarget.reset();
  }

  return (
    <form className="panel form-grid" onSubmit={onSubmit}>
      <h2>意見回饋</h2>
      <label className="field">
        <span>稱呼</span>
        <input className="input" name="name" required />
      </label>
      <label className="field">
        <span>Email</span>
        <input className="input" name="email" type="email" required />
      </label>
      <label className="field">
        <span>內容</span>
        <textarea className="textarea" name="content" required />
      </label>
      <button className="button secondary" type="submit" disabled={isSubmitting}>
        送出
      </button>
      {status ? <p className="status">{status}</p> : null}
    </form>
  );
}
