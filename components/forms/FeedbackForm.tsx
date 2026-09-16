"use client";

import { useState } from "react";
import { executeRecaptcha } from "@/components/forms/recaptcha";

export function FeedbackForm({ initialContent = "" }: { initialContent?: string }) {
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSubmitting(true);
    setStatus("");

    try {
      const formData = new FormData(form);
      formData.set("recaptcha_token", await executeRecaptcha("feedback"));

      const response = await fetch("/jazamila_ajax/save_feedback_post", {
        method: "POST",
        body: formData
      });
      const text = await response.text();
      setStatus(text === "success" ? "已送出你的問題或建議，感謝你。" : "送出失敗，請稍後再試。");
      if (text === "success") form.reset();
    } catch {
      setStatus("驗證失敗，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel form-grid" onSubmit={onSubmit}>
      <h2>如有任何問題或建議，歡迎與我聯繫</h2>
      <label className="field">
        <span>姓名 *</span>
        <input className="input" name="name" placeholder="請輸入大名" required />
      </label>
      <label className="field">
        <span>電子郵件 *</span>
        <input className="input" name="email" placeholder="請輸入電子郵件信箱" type="email" required />
      </label>
      <label className="field">
        <span id="feedback-content-label">問題或建議 *</span>
        <textarea className="textarea" name="content" aria-labelledby="feedback-content-label" defaultValue={initialContent} placeholder="請輸入內容" required />
      </label>
      <button className="button secondary" type="submit" disabled={isSubmitting}>
        確定送出
      </button>
      {status ? <p className="status" role="status">{status}</p> : null}
    </form>
  );
}
