import { RestaurantPostForm } from "@/components/forms/RestaurantPostForm";
import { foodTypes, getRegions, sectionsByRegion } from "@/lib/domain/sections";

const postFaqs = [
  {
    question: "Q1. 餐廳分享？這是在幹嘛？",
    answer: "A1. 這裡是為了讓你分享餐廳資訊用的。"
  },
  {
    question: "Q2. 怎麼分享？",
    answer: "A2. 在上面輸入餐廳資訊，欄位旁有加 * 號的代表必填。"
  },
  {
    question: "Q3. 新增成功後，就能在餐廳列表中，找到我剛剛分享的餐廳了嗎？",
    answer: "A3. 需要稍等一段時間，我會盡快處理。"
  },
  {
    question: "Q4. 為什麼我要分享？有什麼好處？",
    answer: "A4. 相信你一定有注意到，這裡的餐廳資料有點少。你的分享將會豐富這裡的餐廳資訊，並解決更多人不知道要吃什麼的窘境。而在餐廳的介紹頁面，可以放上你個人部落格的食記連結，介紹這家餐廳。當然，如果沒有部落格也可以分享。"
  },
  {
    question: "Q5. 我輸入的餐廳資料好像網站裡面已經有了？怎麼辦？",
    answer: "A5. 沒有關係，我會幫你過濾掉。"
  },
  {
    question: "Q6. 網站上已經有某某餐廳的資料了，但我想分享新的食記連結？怎麼辦？",
    answer: "A6. 你可以在那間餐廳的詳細資訊頁面中新增連結。一樣的，會需要一點時間才會加上去。"
  },
  {
    question: "Q7. 分享的餐廳類型有限制嗎？我可以分享麥當勞嗎？",
    answer: "A7. 沒有。只要你覺得好吃，就可以分享。如果你覺得麥當勞好吃的話，當然可以。"
  },
  {
    question: "Q8. 有人盜用我的部落格連結！",
    answer: "A8. 趕快到關於本站來告訴我！記得請註明詳細事件經過和聯絡資料（Email即可）。"
  }
];

export default function PostPage() {
  return (
    <section className="page-shell detail-grid">
      <div className="form-grid">
        <div className="panel">
          <h1 className="page-title">餐廳分享</h1>
          <p className="lead">有好吃的？請推薦給大家吧！</p>
        </div>
        <div className="panel form-grid">
          <h2>餐廳分享說明</h2>
          {postFaqs.map((faq) => (
            <div className="faq-item" key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
      <RestaurantPostForm regions={getRegions()} sectionsByRegion={sectionsByRegion} foodTypes={foodTypes} />
    </section>
  );
}
