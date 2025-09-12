jazamila
========

關於JAZAMILA
<br>選擇生活，選擇工作，選擇事業，選擇家庭，選擇一台大電視機，
<br>選洗衣機、車子、唱片、電動開罐器，選擇健康、低膽固醇和牙醫保險、定息低率貸款，選擇房子，選擇朋友，選擇休閒服跟搭配的行李箱，選擇各種布料的西裝...

<br>選擇未來，選擇生活...

FAQ
<br><br>Q1. 所以，這裡到底是幹嘛的？
<br>A1. 很簡單。已經是吃飯時間，你懶得在家煮飯，想到外頭找吃的，卻又不知道該吃什麼，這時本站就提供了一個非常非常簡單的解決方式。
<br><br>Q2. 只是為了這個？就做了一個網站？
<br>A2. 對。
<br><br>Q3. 為什麼只為了這個就弄了一個網站...有意義嗎？
<br>A3. 網路的便利性雖然大大的改善了我們的生活，但其實過多的選擇反而會讓人感到不知所措。JAZAMILA所專注的重點，包括提供的資訊、使用者操作的方式，以及網站最終的目標及訴求，都是集中在「簡化」這兩個字上。希望能透過最簡單容易的方式，解決最稀鬆平常的問題，讓我們的精力能集中在更重要的問題上。
<br><br>Q4. 咬文嚼字的，不知道在說什麼？
<br>A4. 好吧！說到底也不是有什麼冠冕堂皇的理由，其實就是站長和站長的朋友們從以前到現在都常常有不知該吃些什麼的煩惱，所以站長就決定弄一個網站，以後又遇到同樣煩惱時只要打開手機在首頁點一下就解決了！多方便啊！
<br><br>Q5. 等一等，這個網站幫我選的餐廳我沒吃過啊，我怎知道好不好吃？
<br>A5. 沒錯，你不知道。那何不就去吃吃看呢？如果好吃你就撿到寶了！不好吃呢？反正就一餐嘛！有什麼了不起的。人生本來就該適時的來點小冒險，不是嗎？
<br><br>Q6. 餐廳資料是不是有點少，而且只有西門町的？
<br>A6. 對，因為網站才剛開不久，餐廳資料之後會慢慢增加。短期目標是收集完西門町所有餐廳的資料。中期目標則是各地重要商圈的資料。
<br><br>Q7. 好，雖然網站訴求還是有點怪怪的，但我還能接受，哪邊加入會員？
<br>A7. 加入會員的地方，目前不會有，未來也不會有。首頁在「吃什麼？」按鈕下方的條件，如果你點選「記得我選的條件」，它會記在「餅乾」裡，你刪掉「餅乾」的話就要重設了。
<br><br>Q8. 這跟猜火車有什麼關係？
<br>A8. 沒有任何關係。
<br>
<br>網站使用codeigniter建置
<br>http://codeigniter.org.tw/

<br>License
<br>除CI本身的License之外，其餘部份採用WTFPL License。
<br>http://en.wikipedia.org/wiki/WTFPL


Environment Variables
----------------------
Copy `.env.example` to `.env` and provide values for the keys below:

* `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY`
* SMTP settings: `SMTP_PROTOCOL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ENCRYPTION`
* Queue connection: `QUEUE_DRIVER`, `QUEUE_HOST`, `QUEUE_PORT`

The `.env` file is ignored by Git to prevent accidental exposure of secrets. Never commit real credentials and ensure filesystem permissions restrict access to the file on production servers.
