import { FeedbackForm } from "@/components/forms/FeedbackForm";

export default function AboutPage() {
  return (
    <section className="page-shell detail-grid">
      <div className="panel">
        <h1 className="page-title">關於本站</h1>
        <p className="lead">
          JAZAMILA 專注在一件小事：已經是吃飯時間，懶得煮，也不想再開一場關於午餐的內心辯論。
        </p>
        <p>
          過多選擇常常讓人不知所措。這裡用最簡單的條件，替你挑出一間餐廳；好吃就賺到，不合胃口也只是人生裡一餐。
        </p>
      </div>
      <FeedbackForm />
    </section>
  );
}
