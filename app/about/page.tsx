import type { Metadata } from "next";
import { FeedbackForm } from "@/components/forms/FeedbackForm";

export const metadata: Metadata = {
  title: "關於本站",
  description: "了解 JAZAMILA 如何用簡單的方式幫你決定今天吃什麼。",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "關於本站｜JAZAMILA",
    description: "了解 JAZAMILA 如何用簡單的方式幫你決定今天吃什麼。",
    url: "/about"
  }
};

const faqs = [
  {
    question: "Q1. 所以，這裡到底是幹嘛的？",
    answer: "A1. 很簡單。已經是吃飯時間，你懶得在家煮飯，想到外頭找吃的，卻又不知道該吃什麼，這時本站就提供了一個非常非常簡單的解決方式。"
  },
  {
    question: "Q2. 只是為了這個？就做了一個網站？",
    answer: "A2. 對。"
  },
  {
    question: "Q3. 為什麼只為了這個就弄了一個網站...有意義嗎？",
    answer: "A3. 網路的便利性雖然大大的改善了我們的生活，但其實過多的選擇反而會讓人感到不知所措。JAZAMILA所專注的重點，包括提供的資訊、使用者操作的方式，以及網站最終的目標及訴求，都是集中在「簡化」這兩個字上。希望能透過最簡單容易的方式，解決最稀鬆平常的問題，讓我們的精力能集中在更重要的問題上。"
  },
  {
    question: "Q4. 咬文嚼字的，不知道在說什麼？",
    answer: "A4. 好吧！說到底也不是有什麼冠冕堂皇的理由，其實就是站長和站長的朋友們從以前到現在都常常有不知該吃些什麼的煩惱，所以站長就決定弄一個網站，以後又遇到同樣煩惱時只要打開手機在首頁點一下就解決了！多方便啊！"
  },
  {
    question: "Q5. 等一等，這個網站幫我選的餐廳我沒吃過啊，我怎知道好不好吃？",
    answer: "A5. 沒錯，你不知道。那何不就去吃吃看呢？如果好吃你就撿到寶了！不好吃呢？反正就一餐嘛！有什麼了不起的。人生本來就該適時的來點小冒險，不是嗎？"
  },
  {
    question: "Q6. 餐廳資料是不是有點少，而且只有西門町的？",
    answer: "A6. 現在已收錄多個城市的餐廳，可以透過城市、地區、料理與價格篩選。餐廳資訊可能變動，出發前請再向店家確認。"
  },
  {
    question: "Q7. 好，雖然網站訴求還是有點怪怪的，但我還能接受，哪邊加入會員？",
    answer: "A7. 加入會員的地方，目前不會有，未來也不會有。首頁的篩選條件會自動記在瀏覽器 Cookie 裡；清除 Cookie 後，條件就會恢復預設值。"
  },
  {
    question: "Q8. 這跟猜火車有什麼關係？",
    answer: "A8. 沒有任何關係。"
  }
];

export default async function AboutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const id = Number(query.restaurant);
  const name = typeof query.name === "string" ? query.name.slice(0, 120) : "";
  const initialContent = Number.isSafeInteger(id) && id > 0 ? `餐廳資料回報：${name}（ID ${id}）\n餐廳頁面：/detail/${id}\n回報內容（資料有誤／已歇業）：\n` : "";
  if (initialContent) return <section className="page-shell" style={{ maxWidth: 720 }}>
    <h1 className="page-title">回報餐廳資料</h1>
    <p className="lead">回報將由管理者確認，不會直接更動餐廳資料。</p>
    <FeedbackForm key={initialContent} initialContent={initialContent} />
    <a className="text-link" href={`/detail/${id}`}>返回餐廳</a>
  </section>;
  return (
    <section className="page-shell detail-grid">
      <div className="form-grid">
        <div className="panel">
          <h1 className="page-title">關於JAZAMILA</h1>
          <p className="lead">
            選擇生活，選擇工作，選擇事業，選擇家庭，選擇一台大電視機，
            選洗衣機、車子、唱片、電動開罐器，選擇健康、低膽固醇和牙醫保險、定息低率貸款，選擇房子，選擇朋友，選擇休閒服跟搭配的行李箱，
            選擇各種布料的西裝...
          </p>
          <p>選擇未來，選擇生活...</p>
        </div>

        <div className="panel form-grid">
          <h2>FAQ</h2>
          {faqs.map((faq) => (
            <div className="faq-item" key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
      <FeedbackForm key={initialContent} initialContent={initialContent} />
    </section>
  );
}
