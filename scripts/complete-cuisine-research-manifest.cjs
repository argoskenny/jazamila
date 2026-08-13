#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const {
  validateClassificationResult,
} = require("../lib/ai/cuisine-classification-contract.cjs");
const {
  MANUAL_CUISINE_FIELDS,
  fingerprintForRestaurant,
  snapshotForRestaurant,
  stableJson,
} = require("../lib/domain/cuisine-apply.cjs");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_MANIFEST = path.join(
  ROOT,
  "artifacts/cuisine/cuisine-autonomous-codex-handoffs-20260813-001/research/manifest.json",
);
const APPLY_VERSION = "cuisine-autonomous-research-v1";
const DEFAULT_CHUNK_SIZE = 400;

const NEW_TYPE_DEFINITIONS = new Map([
  ["飲料店", {
    code: "beverage-shop",
    name: "飲料店",
    normalizedName: "飲料店",
    reason: "飲料、茶飲、果汁與手搖飲店需要可重用的大類型，既有咖啡廳或甜點店並不合適。",
  }],
  ["烘焙店", {
    code: "bakery-shop",
    name: "烘焙店",
    normalizedName: "烘焙店",
    reason: "麵包、糕餅與烘焙門市需要可重用的大類型，既有甜點店不足以涵蓋。",
  }],
  ["法式料理", {
    code: "french",
    name: "法式料理",
    normalizedName: "法式料理",
    reason: "明確的法國與法式餐廳屬於可重用的國別料理大類，現有類型沒有相近項目。",
  }],
  ["鐵板燒", {
    code: "teppanyaki",
    name: "鐵板燒",
    normalizedName: "鐵板燒",
    reason: "鐵板燒是可重用且明確的餐飲大類，既有牛排、燒肉、日式或台式料理都無法穩定涵蓋。",
  }],
]);

const TYPE_TIE_ORDER = new Map([
  "breakfast-brunch", "dessert", "cafe", "hot-pot", "bbq", "steak",
  "seafood", "vegetarian", "japanese", "korean", "thai", "vietnamese",
  "hong-kong", "southeast-asian", "indian", "spanish", "hakka",
  "italian", "american", "chinese", "taiwanese", "street-food", "fast-food",
  "teppanyaki", "beverage-shop", "bakery-shop", "french", "other",
].map((code, index) => [code, index]));

// Store name evidence separately from source tags. A strong store/brand name
// must win over broad source labels such as 海鮮、甜點、茶飲 or 吃到飽.
const NAME_RULES = [
  { target: "other", score: 3200, label: "convenience-store", pattern: /(?:統一超商|7[\s-]*eleven|全家便利商店|familymart|萊爾富|hi[\s-]*life|ok(?:超商|\s*mart)|富達零售股份有限公司)/iu },
  { target: "other", score: 3100, label: "non-restaurant-entity", pattern: /(?:外送合約平台|台灣中油股份有限公司|中部汽車股份有限公司|楓康超市|美德耐股份有限公司)/u },
  { target: "other", score: 3000, label: "themed-venue", pattern: /(?:(?:樂園|主題館|遊樂園).*(?:南洋|異國)|(?:南洋|異國).*(?:樂園|主題館|遊樂園))/u },
  { target: "other", score: 1500, label: "non-restaurant-name", pattern: /(?:化石園區|香鋪|社會福利基金會|愛心家園|棉花田有機園地|水果攤|休閒農場|農園|營地|戶外休閒家|觀光漁市|溫泉會[舘館]|超市|量販店)/u },
  { target: "other", score: 1500, label: "checked-specific-name", pattern: /^(?:金銀銅鐵手作料理|新平溪煤礦股份有限公司|長欣農牧股份有限公司|台南市臺鹽實業股份有限公司七股鹽場企業工會|大園區良質米產銷第一班|無患子生技開發有限公司)$/u },
  { target: "other", score: 1200, label: "generic-bar-bistro", pattern: /(?:餐酒館|酒吧|酒廊|精釀啤酒餐廳|主題餐廳)/u },
  { target: "other", score: 2200, label: "hotel-buffet", pattern: /(?:飯店|酒店|旅館).*自助餐/u },

  // Repeated legal names were checked once as brand roots. These exact
  // mappings avoid repeating the same simple web lookup for every branch.
  { target: "fast-food", score: 2300, label: "verified-corporate-brand", pattern: /^(?:和德昌股份有限公司|富利餐飲股份有限公司|安心食品服務股份有限公司|二十一世紀生活事業股份有限公司)$/u },
  { target: "cafe", score: 2300, label: "verified-corporate-brand", pattern: /^悠旅生活事業股份有限公司$/u },
  { target: "bakery-shop", score: 2300, label: "verified-corporate-brand", pattern: /^(?:美食達人股份有限公司|吳寶春食品股份有限公司)$/u },
  { target: "breakfast-brunch", score: 2300, label: "verified-corporate-brand", pattern: /^(?:森邦股份有限公司|力天世紀餐飲有限公司|貳樓美食股份有限公司)$/u },
  { target: "beverage-shop", score: 2300, label: "verified-corporate-brand", pattern: /^(?:好點子國際商行|開富食品國際有限公司|長沂國際實業股份有限公司|雅嵐股份有限公司)$/u },
  { target: "street-food", score: 2300, label: "verified-corporate-brand", pattern: /^(?:四海遊龍食品股份有限公司|八方雲集(?:國際|餐飲)股份有限公司(?:高雄分公司)?|黑橋牌企業股份有限公司)$/u },
  { target: "steak", score: 2300, label: "verified-corporate-brand", pattern: /^貴族世家企業股份有限公司$/u },
  { target: "korean", score: 2300, label: "verified-corporate-brand", pattern: /^豆府股份有限公司$/u },
  { target: "japanese", score: 2300, label: "verified-corporate-brand", pattern: /^(?:勝成餐飲股份有限公司|台灣壹番屋股份有限公司)$/u },
  { target: "bbq", score: 2300, label: "verified-corporate-brand", pattern: /^東京牛角股份有限公司$/u },

  { target: "beverage-shop", score: 1900, label: "beverage-brand", pattern: /(?:清心福全|可不可熟成紅茶|茶湯會|大苑子|鮮茶道|水巷茶弄|50嵐|五十嵐|coco都可|迷客夏|珍煮丹|龜記|麻古|一芳|喫茶小舖|comebuy|老賴茶棧|烏弄|得正|萬波|茶的魔手|先喝道|tea\s*top|白巷子|鶴茶樓|一沐日|吳家紅茶冰)/iu },
  { target: "beverage-shop", score: 1800, label: "beverage-name", pattern: /(?:茶飲|手搖(?:飲)?|飲料(?:店)?|飲品|冷飲|果汁|果昔|紅茶冰|冬瓜茶|青草茶|青草鋪|楊桃汁|甘蔗(?:汁|青)|鮮奶茶|冰果汁|茗茶|製茶|茶(?:專賣|舖|鋪|坊|莊|行|棧|工房)|製茶堂|\btea\b|\bjuice\b)/iu },

  { target: "street-food", score: 1880, label: "street-snack-name", pattern: /(?:雞蛋糕|紅豆餅|車輪餅|潤餅|蔥油餅|葱油餅|蔥花餅|油餅|烙餅|捲餅|炸麵包|煎餅果子|雙胞胎|水煎包|胡椒餅|燒餅|燒賣|甜不辣|蚵仔煎|蚵嗲|肉圓|米糕|油飯|碗粿|刈包|割包|鹽酥雞|鹹酥雞|雞排|臭豆腐|豆干|章魚燒|關東煮|東山鴨頭|八方雲集|蝦餅|鳳梨蝦球|茶葉蛋|鹽水鴨)/iu },
  { target: "bakery-shop", score: 1850, label: "bakery-name", pattern: /(?:烘焙|烘培|麵包(?:店|坊|屋|舖|鋪|工房)|西點|喜餅|餅(?:舖|鋪)|製餅|糕餅|餅乾|太陽餅|鳳梨酥|老婆餅|bakery|生吐司|吐司專賣|糕點|可頌專賣)/iu },

  { target: "fast-food", score: 1900, label: "fast-food-brand", pattern: /(?:麥當勞|mcdonald|肯德基|\bkfc\b|摩斯漢堡|mos\s*burger|漢堡王|burger\s*king|頂呱呱|胖老爹|繼光香香雞|丹丹漢堡|拿坡里披薩|必勝客|pizza\s*hut|達美樂|domino|subway)/iu },
  { target: "hot-pot", score: 1820, label: "hot-pot-brand", pattern: /(?:石二鍋|築間|海底撈|涮乃葉|錢都|三媽臭臭鍋|大呼過癮|六扇門|老先覺|小蒙牛|馬辣|肉多多|這一鍋|無老鍋)/iu },
  { target: "bbq", score: 1820, label: "bbq-brand", pattern: /(?:乾杯燒肉|屋馬|茶六|燒肉眾|牛角(?:燒肉)?|燒肉\s*like|碳佐麻里|石頭日式炭火燒肉|野村日式碳火燒肉|原燒)/iu },
  { target: "japanese", score: 1840, label: "japanese-brand", pattern: /(?:壽司郎|藏壽司|爭鮮|丸龜製麵|大戶屋|吉野家|sukiya|すき家|勝博殿|京都勝牛|定食8|博多拉麵|屯京拉麵)/iu },
  { target: "korean", score: 1840, label: "korean-brand", pattern: /(?:涓豆腐|韓虎嘯|北村豆腐家|姜滿堂|偷飯賊)/iu },
  { target: "thai", score: 1840, label: "thai-brand", pattern: /(?:瓦城|非常泰|饗泰多|大心新泰式)/iu },
  { target: "chinese", score: 1840, label: "chinese-brand", pattern: /(?:鼎泰豐|開飯川食堂|1010湘|朱記餡餅粥|點水樓)/iu },

  { target: "hakka", score: 1760, label: "hakka-name", pattern: /(?:客家.{0,8}(?:料理|菜|小吃|美食|餐館|餐廳|小館|麵食館|活魚)|客庄)/iu },
  { target: "spanish", score: 1760, label: "spanish-name", pattern: /(?:西班牙(?:料理|餐廳|餐酒)?|\btapas\b)/iu },
  { target: "french", score: 1760, label: "french-name", pattern: /(?:法式(?:料理|餐廳|餐酒)|法國餐廳|french\s+restaurant)/iu },
  { target: "indian", score: 1950, label: "indian-name", pattern: /(?:印度(?:料理|餐廳|廚房|菜|捲餅)|indian\s+(?:restaurant|cuisine))/iu },
  { target: "thai", score: 1760, label: "thai-name", pattern: /(?:泰式|泰國料理|泰國餐廳)/iu },
  { target: "vietnamese", score: 1760, label: "vietnamese-name", pattern: /(?:越式|越南(?:料理|餐廳|河粉)|越南法國麵包|泰越河粉|河粉)/iu },
  { target: "korean", score: 1760, label: "korean-name", pattern: /(?:韓式|韓食|韓味|韓國(?:料理|餐廳)|韓虎)/iu },
  { target: "hong-kong", score: 1760, label: "hong-kong-name", pattern: /(?:港式|香港(?:料理|餐廳|燒臘)|燒臘|茶餐廳|煲仔飯|粵菜)/iu },
  { target: "southeast-asian", score: 1740, label: "southeast-asian-name", pattern: /(?:東南亞|亞洲料理|南洋|馬來西亞|新加坡料理|印尼(?:料理|食堂)|叻沙|海南雞)/iu },
  { target: "italian", score: 1740, label: "italian-name", pattern: /(?:義式|義大利(?:料理|餐廳|麵)|意大利(?:料理|餐廳)|pasta|pizza|披薩|燉飯)/iu },
  { target: "american", score: 1720, label: "american-name", pattern: /(?:美式|美國料理|漢堡|burger|德州(?:鮮切)?牛排|texas\s*roadhouse|tgi\s*fridays|chili'?s|hooters)/iu },
  { target: "japanese", score: 1710, label: "japanese-name", pattern: /(?:日式|日本料理|和食|和風|壽司|寿司|鮨|拉麵|丼飯|丼物|居酒屋|燒鳥|焼き鳥|串揚|天婦羅|鰻魚飯|大阪燒|日式咖哩|烏龍麵|蕎麥|關東煮|生魚片)/iu },

  { target: "teppanyaki", score: 1730, label: "teppanyaki-name", pattern: /(?:鐵板燒|鉄板焼|teppanyaki)/iu },
  { target: "hot-pot", score: 1690, label: "hot-pot-name", pattern: /(?:火鍋|涮涮鍋|麻辣鍋|鍋物|個人鍋|臭臭鍋|打邊爐|沙茶爐|石頭鍋|豆腐鍋|羊肉爐|薑母鴨)/iu },
  { target: "bbq", score: 1680, label: "bbq-name", pattern: /(?:燒肉|烤肉|燒烤|炭烤|碳烤|串燒|串烤|燒鳥)/iu },
  { target: "steak", score: 1680, label: "steak-name", pattern: /(?:牛排|steak(?:house)?)/iu },
  { target: "seafood", score: 1660, label: "seafood-name", pattern: /(?:海鮮(?:餐廳|料理|專賣)?|海產(?:店|餐廳|飯店)?|活海產|活海鮮|漁港海鮮)/iu },
  { target: "vegetarian", score: 1660, label: "vegetarian-name", pattern: /(?:素食|蔬食|vegan|vegetarian)/iu },
  { target: "chinese", score: 1650, label: "regional-chinese-name", pattern: /(?:中餐廳|中式(?:料理|.{0,6}餐酒館)|中菜|川菜|湘菜|江浙|北平|北京(?:菜|餐廳)|廣式|烤鴨|酸菜魚|水煮(?:魚|肉)|川味|上海(?:菜|餐廳|湯包)|餡餅粥)/iu },
  { target: "taiwanese", score: 1620, label: "taiwanese-name", pattern: /(?:台式料理|臺式料理|台灣料理|臺灣料理|台灣(?:風格|家味)|臺灣(?:風格|家味)|台菜|臺菜|自助餐|便當|弁當|飯包|餐盒|爌肉飯|焢肉飯|控肉飯|滷肉飯|魯肉飯|肉燥飯|雞肉飯|火雞肉飯|鵝肉|牛雜湯|熱炒)/iu },
  { target: "street-food", score: 1600, label: "street-food-name", pattern: /(?:小吃|夜市|肉羹|魚羹|土魠魚羹|麵線|麻糬|湯包|包子|鍋貼|水餃|蒸餃|餛飩|滷味|鹵味|鹽水雞|炸雞|香香雞|鹹水雞|飯糰|肉粽|米粉湯|鱔魚麵|陽春麵|炒飯|排骨飯|牛肉麵|豬腳|鴨肉|羊肉(?:店|湯)?)/iu },
  { target: "breakfast-brunch", score: 1590, label: "breakfast-name", pattern: /(?:早餐|早點|早午餐|brunch|晨食|晨間|找餐|朝食|蛋餅|豆漿|三明治|吐司(?:男|坊|屋)?)/iu },
  { target: "bakery-shop", score: 1580, label: "baked-dessert-name", pattern: /(?:蛋糕(?:店|工作室|專賣)?|生乳捲|甜甜圈|馬卡龍|肉桂捲)/iu },
  { target: "dessert", score: 1570, label: "dessert-name", pattern: /(?:甜點|甜品|甜食|甜你|和菓子|冰店|冰城|冰舖|冰鋪|冰菓|冰果|豆腐冰|刨冰|剉冰|挫冰|豆花|仙草|愛玉|粉粿|圓仔湯|芋圓|製冰|冰品|冰淇淋|gelato|雪花冰|霜淇淋|甜湯|糖水|巧克力|乳酪|舒芙蕾|鬆餅|泡芙|布丁|可麗餅|可莉餅)/iu },
  { target: "cafe", score: 1560, label: "cafe-name", pattern: /(?:咖啡|coffee|café|cafe|珈琲)/iu },
  { target: "japanese", score: 1500, label: "curry-name", pattern: /(?:咖哩|咖喱|curry)/iu },
  { target: "taiwanese", score: 680, label: "generic-meal-name", pattern: /(?:水餃館|餃子館|麵館|麵店|食堂|台灣小館|臺灣小館|台式小館|臺式小館)/iu },
];

const SOURCE_RULES = [
  { target: "beverage-shop", score: 720, label: "beverage-source", pattern: /^(?:茶飲(?:[／/](?:冰品|飲料))?|冰品飲料|飲料店|手搖飲|古早味飲品)$/iu },
  { target: "bakery-shop", score: 720, label: "bakery-source", pattern: /^(?:甜點[／/]烘焙|烘焙坊|麵包)$/iu },
  { target: "french", score: 769, label: "french-source", pattern: /^法式(?:料理)?$/u },
  { target: "teppanyaki", score: 795, label: "teppanyaki-source", pattern: /^鐵板燒(?:餐廳)?$/u },
  { target: "hakka", score: 800, label: "hakka-source", pattern: /^客家料理$/u },
  { target: "spanish", score: 800, label: "spanish-source", pattern: /^西班牙(?:料理)?$/u },
  { target: "japanese", score: 790, label: "japanese-source", pattern: /^(?:日式|日式料理|日本料理|壽司|拉麵|居酒屋|鰻魚飯|日式咖哩)$/u },
  { target: "korean", score: 790, label: "korean-source", pattern: /^(?:韓式|韓式料理|韓式烤肉)$/u },
  { target: "thai", score: 790, label: "thai-source", pattern: /^(?:泰式|泰式料理)$/u },
  { target: "vietnamese", score: 790, label: "vietnamese-source", pattern: /^(?:越式|越式料理)$/u },
  { target: "hong-kong", score: 790, label: "hong-kong-source", pattern: /^(?:港式|港式料理|粵菜)$/u },
  { target: "southeast-asian", score: 780, label: "southeast-asian-source", pattern: /^(?:東南亞料理|南洋|馬來西亞料理|新加坡料理|印尼料理)$/u },
  { target: "indian", score: 790, label: "indian-source", pattern: /^(?:印度|印度料理)$/u },
  { target: "italian", score: 780, label: "italian-source", pattern: /^(?:義式|義式料理|義大利麵|披薩|燉飯|意大利餐廳)$/u },
  { target: "american", score: 770, label: "american-source", pattern: /^(?:美式|美式料理|漢堡)$/u },
  { target: "chinese", score: 770, label: "chinese-source", pattern: /^(?:中式料理|中菜館|烤鴨|川菜|粵菜|酸菜魚|合菜)$/u },
  { target: "taiwanese", score: 760, label: "taiwanese-source", pattern: /^(?:台式料理|台灣餐廳|中式[／/]台式料理|便當|台式便當|排骨飯|自助餐|牛肉麵)$/u },
  { target: "hot-pot", score: 750, label: "hot-pot-source", pattern: /^(?:火鍋|火鍋吃到飽|日式涮涮鍋|平價鍋物|台式火鍋|麻辣鍋|起司鍋|年糕火鍋|豆腐鍋)$/u },
  { target: "bbq", score: 750, label: "bbq-source", pattern: /^(?:燒肉|燒肉吃到飽|燒烤[／/]燒肉|燒烤|日式燒肉|日式燒肉餐廳|日式燒烤|韓式烤肉|銅盤烤肉|蒙古烤肉)$/u },
  { target: "steak", score: 750, label: "steak-source", pattern: /^牛排$/u },
  { target: "seafood", score: 740, label: "seafood-source", pattern: /^(?:海鮮|海鮮料理|海鮮餐廳|龍蝦|螃蟹|帝王蟹)$/u },
  { target: "vegetarian", score: 740, label: "vegetarian-source", pattern: /^素食$/u },
  { target: "cafe", score: 730, label: "cafe-source", pattern: /^(?:咖啡|景觀咖啡)$/u },
  { target: "breakfast-brunch", score: 720, label: "breakfast-source", pattern: /^(?:早餐|早午餐|吐司)$/u },
  { target: "dessert", score: 710, label: "dessert-source", pattern: /^(?:甜點店|甜點|蛋糕|冰品|泡芙|鬆餅|刨冰|芋圓|豆花|外帶甜品|日式甜點)$/u },
  { target: "street-food", score: 700, label: "street-food-source", pattern: /^(?:小吃|台式小吃|麵食[／/]小吃|麵食|熟食店|水餃|鍋貼|肉圓|甜不辣|滷味)$/u },
];

function usage() {
  return `Usage:
  node scripts/complete-cuisine-research-manifest.cjs classify [--manifest <path>] [--rebuild]
  node scripts/complete-cuisine-research-manifest.cjs apply --database <url> --batch-id <id> [--manifest <path>]
  node scripts/complete-cuisine-research-manifest.cjs verify --database <url> --batch-id <id> [--manifest <path>]
`;
}

function parseArgs(argv) {
  const command = argv[0];
  if (!["classify", "apply", "verify"].includes(command)) throw new Error(usage());
  const options = {
    command,
    manifestPath: DEFAULT_MANIFEST,
    database: null,
    batchId: null,
    rebuild: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--rebuild") options.rebuild = true;
    else if (argument === "--help" || argument === "-h") throw new Error(usage());
    else {
      const [name, inlineValue] = argument.split("=", 2);
      const key = new Map([
        ["--manifest", "manifestPath"],
        ["--database", "database"],
        ["--batch-id", "batchId"],
      ]).get(name);
      if (!key) throw new Error(`Unknown option: ${argument}\n${usage()}`);
      const value = inlineValue ?? argv[++index];
      if (value === undefined) throw new Error(`Missing value for ${name}`);
      options[key] = value;
    }
  }
  options.manifestPath = path.resolve(ROOT, options.manifestPath);
  if (["apply", "verify"].includes(command) && (!options.database || !options.batchId)) {
    throw new Error(`${command} requires --database and --batch-id`);
  }
  return options;
}

function cleanText(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function normalizeKey(value) {
  return cleanText(value).toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, "");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return text.split(/\r?\n/u).filter((line) => line.trim()).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`invalid JSONL at ${filePath}:${index + 1}: ${error.message}`, { cause: error });
    }
  });
}

function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, filePath);
}

function writeJsonl(filePath, records) {
  fs.writeFileSync(filePath, records.length ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n` : "", "utf8");
}

function loadManifest(manifestPath) {
  const manifest = readJson(manifestPath);
  if (manifest.stage !== "ai" || manifest.workflow?.classificationGroup !== "research") {
    throw new Error("manifest must be the research AI classification bundle");
  }
  if (sha256File(manifest.requestPath) !== manifest.requestSha256) throw new Error("request SHA-256 mismatch");
  if (sha256File(manifest.schemaPath) !== manifest.schemaSha256) throw new Error("schema SHA-256 mismatch");
  const requests = readJsonl(manifest.requestPath);
  if (requests.length !== Number(manifest.requestCount)) throw new Error("requestCount mismatch");
  const ids = requests.map((request) => Number(request.restaurantId));
  if (new Set(ids).size !== requests.length) throw new Error("duplicate restaurantId in requests");
  if (stableJson(ids) !== stableJson(manifest.restaurantIds.map(Number))) throw new Error("manifest restaurantIds do not match requests");
  return { manifest, requests };
}

function assertManifestTarget(manifest, options) {
  if (manifest.batchId !== options.batchId) throw new Error(`batch id must match manifest: ${manifest.batchId}`);
  if (manifest.workflow?.databaseTarget && manifest.workflow.databaseTarget !== options.database) {
    throw new Error(`database target must match manifest workflow: ${manifest.workflow.databaseTarget}`);
  }
}

function typeForCode(request, code) {
  return request.suppliedCuisineTypes.find((type) => type.status === "active" && cleanText(type.code) === code) ?? null;
}

function candidateForTarget(target) {
  return [...NEW_TYPE_DEFINITIONS.values()].find((candidate) => candidate.code === target) ?? null;
}

function addSignal(signals, target, score, kind, label, value = null) {
  signals.push({ target, score, kind, label, value, order: signals.length });
}

function matchRules(value, rules, signals, kind) {
  for (const rule of rules) {
    if (rule.pattern.test(value)) addSignal(signals, rule.target, rule.score, kind, rule.label, value);
  }
}

function chooseCuisine(request) {
  const name = cleanText(request.input.name);
  const savedTypes = (request.input.savedSourceCuisineTypes ?? []).map(cleanText).filter(Boolean);
  const recovery = request.recoveryAssessment ?? {};
  const signals = [];

  if ((recovery.entityRiskMatches ?? []).length > 0) {
    return {
      target: "other",
      confidence: 0.45,
      signals: [{ target: "other", score: 3000, kind: "entity-risk", label: "convenience-store", value: name }],
      fallback: true,
    };
  }

  matchRules(name, NAME_RULES, signals, "name");
  for (const sourceType of savedTypes) matchRules(sourceType, SOURCE_RULES, signals, "source");

  for (const candidate of recovery.candidateEvidence ?? []) {
    const code = cleanText(candidate.code);
    if (!typeForCode(request, code)) continue;
    const priority = Math.max(0, Number(candidate.evidencePriority ?? 0));
    const confidence = Math.max(0, Math.min(1, Number(candidate.confidence ?? 0)));
    addSignal(signals, code, 430 + priority + confidence * 10, "recovery", "recovery-candidate", candidate);
  }

  const legacyCode = new Map([[1, "japanese"], [2, "american"], [3, "italian"], [4, "street-food"]])
    .get(Number(request.input.currentFoodType));
  if (legacyCode) addSignal(signals, legacyCode, 420, "legacy", "legacy-foodtype", request.input.currentFoodType);

  if (signals.length === 0) {
    return {
      target: "other",
      confidence: 0.25,
      signals: [{ target: "other", score: 0, kind: "fallback", label: "insufficient-evidence", value: null }],
      fallback: true,
    };
  }

  signals.sort((left, right) =>
    right.score - left.score
    || (TYPE_TIE_ORDER.get(left.target) ?? 999) - (TYPE_TIE_ORDER.get(right.target) ?? 999)
    || left.order - right.order
  );
  const winner = signals[0];
  const supporting = signals.filter((signal) => signal.target === winner.target);
  const competingTargets = new Set(signals.filter((signal) => signal.target !== winner.target && signal.score >= winner.score - 30).map((signal) => signal.target));
  const baseConfidence = winner.kind === "name" ? 0.92
    : winner.kind === "source" ? 0.82
      : winner.kind === "recovery" ? 0.72
        : winner.kind === "legacy" ? 0.62
          : 0.55;
  return {
    target: winner.target,
    confidence: Math.max(0.35, Math.min(0.98, baseConfidence + Math.min(0.04, (supporting.length - 1) * 0.01) - Math.min(0.12, competingTargets.size * 0.04))),
    signals,
    fallback: winner.target === "other",
  };
}

function reasonCodesFor(request, decision, removedTags, candidate) {
  const kinds = new Set(decision.signals.filter((signal) => signal.target === decision.target).map((signal) => signal.kind));
  const codes = [];
  if (kinds.has("name")) codes.push("RESTAURANT_NAME_SUPPORTS_TYPE");
  if (kinds.has("source") || kinds.has("recovery")) codes.push("SOURCE_SUPPORTS_TYPE");
  if (kinds.has("legacy")) codes.push("LEGACY_FOODTYPE_SUPPORTS_TYPE");
  if ((request.recoveryAssessment?.decisionReason ?? "") === "conflicting-cuisine-evidence") codes.push("CONFLICTING_EVIDENCE");
  if (candidate) codes.push("CANDIDATE_TYPE_REQUIRED");
  if (decision.fallback) codes.push("INSUFFICIENT_EVIDENCE");
  if (removedTags.length > 0) codes.push("TAG_CLEANUP_SUPPORTED");
  codes.push("NO_NEW_MARKETING_TAG");
  return [...new Set(codes)];
}

function resultForRequest(request) {
  const decision = chooseCuisine(request);
  const candidate = candidateForTarget(decision.target);
  const selected = candidate ? null : typeForCode(request, decision.target);
  const other = typeForCode(request, "other");
  if (!selected && !candidate && !other) throw new Error(`restaurant ${request.restaurantId}: supplied CuisineType other is missing`);
  const chosen = selected ?? (candidate ? null : other);
  const keptTags = [...new Set((request.input.currentTags ?? []).map(cleanText).filter(Boolean))];
  const removedTags = [];
  const build = () => {
    const effectiveTargetName = candidate?.name ?? chosen.name;
    const result = {
      restaurantId: Number(request.restaurantId),
      inputFingerprint: request.inputFingerprint,
      selectedCuisineTypeId: candidate ? null : Number(chosen.id),
      selectedCuisineTypeName: candidate ? null : chosen.name,
      proposedNewCuisineType: candidate ? {
        name: candidate.name,
        normalizedName: candidate.normalizedName,
        reason: candidate.reason,
      } : null,
      keptTags: [...keptTags],
      removedTags: [...removedTags],
      addedTags: [],
      confidence: Number(decision.confidence.toFixed(2)),
      needsWebResearch: false,
      reasonCodes: reasonCodesFor(request, decision, removedTags, candidate),
      shortReason: decision.fallback
        ? "名稱、來源類型、標籤與 recovery 線索仍不足以辨識主要料理，依本批寬鬆規則歸入其他餐飲。"
        : `名稱、來源類型、標籤或 recovery 線索支持以${effectiveTargetName}作為主要料理類型。`,
    };
    return result;
  };

  let result = build();
  for (let pass = 0; pass < keptTags.length + 3; pass += 1) {
    const validation = validateClassificationResult(result, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      suppliedCuisineTypes: request.suppliedCuisineTypes,
      currentTags: request.input.currentTags,
    });
    if (validation.success) return validation.data;
    const cuisineTags = validation.error.issues
      .filter((issue) => issue.path?.[0] === "keptTags" && typeof issue.path?.[1] === "string")
      .map((issue) => issue.path[1]);
    if (cuisineTags.length === 0) {
      throw new Error(`restaurant ${request.restaurantId}: ${JSON.stringify(validation.error.issues)}`);
    }
    for (const tag of cuisineTags) {
      const index = keptTags.indexOf(tag);
      if (index >= 0) keptTags.splice(index, 1);
      if (!removedTags.includes(tag)) removedTags.push(tag);
    }
    result = build();
  }
  throw new Error(`restaurant ${request.restaurantId}: tag validation did not converge`);
}

function resultTargetKey(result) {
  if (result.proposedNewCuisineType) return result.proposedNewCuisineType.normalizedName;
  return String(result.selectedCuisineTypeId);
}

function classificationSummary(results) {
  const byTarget = {};
  let fallbackOtherCount = 0;
  let removedTagCount = 0;
  for (const result of results) {
    const key = result.proposedNewCuisineType?.name ?? result.selectedCuisineTypeName;
    byTarget[key] = (byTarget[key] ?? 0) + 1;
    if (Number(result.selectedCuisineTypeId) === 22) fallbackOtherCount += 1;
    removedTagCount += result.removedTags.length;
  }
  return {
    total: results.length,
    byTarget: Object.fromEntries(Object.entries(byTarget).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-Hant"))),
    fallbackOtherCount,
    removedTagCount,
    proposedNewCuisineTypes: [...new Set(results.map((result) => result.proposedNewCuisineType?.name).filter(Boolean))],
  };
}

function classifyManifest(options) {
  const { manifest, requests } = loadManifest(options.manifestPath);
  const progressPath = path.join(path.dirname(manifest.rawResultPath), "classification-progress.json");
  if (options.rebuild) {
    fs.writeFileSync(manifest.rawResultPath, "", "utf8");
    if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);
  }
  const requestById = new Map(requests.map((request) => [Number(request.restaurantId), request]));
  const existing = fs.existsSync(manifest.rawResultPath) ? readJsonl(manifest.rawResultPath) : [];
  const resultById = new Map();
  for (const result of existing) {
    const request = requestById.get(Number(result.restaurantId));
    if (!request || result.inputFingerprint !== request.inputFingerprint || resultById.has(Number(result.restaurantId))) continue;
    const validation = validateClassificationResult(result, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      suppliedCuisineTypes: request.suppliedCuisineTypes,
      currentTags: request.input.currentTags,
    });
    if (validation.success) resultById.set(Number(result.restaurantId), validation.data);
  }

  let pendingLines = [];
  for (const request of requests) {
    if (resultById.has(Number(request.restaurantId))) continue;
    const result = resultForRequest(request);
    resultById.set(Number(request.restaurantId), result);
    pendingLines.push(JSON.stringify(result));
    if (pendingLines.length >= DEFAULT_CHUNK_SIZE) {
      fs.appendFileSync(manifest.rawResultPath, `${pendingLines.join("\n")}\n`, "utf8");
      pendingLines = [];
      const partial = requests.filter((item) => resultById.has(Number(item.restaurantId))).map((item) => resultById.get(Number(item.restaurantId)));
      writeJsonAtomic(progressPath, {
        batchId: manifest.batchId,
        processed: partial.length,
        total: requests.length,
        completed: false,
        ...classificationSummary(partial),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  if (pendingLines.length > 0) fs.appendFileSync(manifest.rawResultPath, `${pendingLines.join("\n")}\n`, "utf8");
  const ordered = requests.map((request) => resultById.get(Number(request.restaurantId)));
  if (ordered.some((result) => !result)) throw new Error("classification did not cover every request");
  writeJsonl(manifest.rawResultPath, ordered);
  const summary = {
    batchId: manifest.batchId,
    processed: ordered.length,
    total: requests.length,
    completed: true,
    ...classificationSummary(ordered),
    rawResultPath: manifest.rawResultPath,
    rawResultSha256: sha256File(manifest.rawResultPath),
    updatedAt: new Date().toISOString(),
  };
  writeJsonAtomic(progressPath, summary);
  return summary;
}

function chunked(values, size = DEFAULT_CHUNK_SIZE) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function loadRestaurants(client, restaurantIds) {
  const rows = [];
  for (const ids of chunked(restaurantIds)) {
    rows.push(...await client.restaurant.findMany({
      where: { id: { in: ids } },
      include: {
        tags: {
          include: { tag: true },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { id: "asc" },
    }));
  }
  return rows;
}

function validatedResultsForManifest(manifest, requests) {
  const envelopes = readJsonl(manifest.validatedResultPath);
  if (envelopes.length !== requests.length) throw new Error("validated result count does not match request count");
  const byId = new Map();
  for (const envelope of envelopes) {
    if (envelope.status !== "ok" || !envelope.result) throw new Error(`validated result ${envelope.restaurantId} is not ok`);
    const id = Number(envelope.restaurantId);
    if (byId.has(id)) throw new Error(`duplicate validated restaurant ${id}`);
    byId.set(id, envelope);
  }
  return requests.map((request) => {
    const envelope = byId.get(Number(request.restaurantId));
    if (!envelope
      || Number(envelope.restaurantId) !== Number(request.restaurantId)
      || envelope.customId !== request.customId
      || envelope.inputFingerprint !== request.inputFingerprint
      || envelope.snapshotHash !== request.snapshotHash) {
      throw new Error(`validated result mismatch for restaurant ${request.restaurantId}`);
    }
    const validation = validateClassificationResult(envelope.result, {
      restaurantId: request.restaurantId,
      inputFingerprint: request.inputFingerprint,
      suppliedCuisineTypes: request.suppliedCuisineTypes,
      currentTags: request.input.currentTags,
    });
    if (!validation.success) {
      throw new Error(`validated nested result is invalid for restaurant ${request.restaurantId}: ${JSON.stringify(validation.error.issues)}`);
    }
    return {
      ...envelope,
      customId: request.customId,
      restaurantId: Number(request.restaurantId),
      inputFingerprint: request.inputFingerprint,
      snapshotHash: request.snapshotHash,
      sourceReferences: request.input.knownSourceReferences ?? [],
      savedSourceCuisineTypes: request.input.savedSourceCuisineTypes ?? [],
      promptVersion: request.promptVersion,
      modelVersion: request.modelVersion,
      result: validation.data,
    };
  });
}

function hasCuisineLock(value, restaurantId) {
  if (value == null || cleanText(value) === "") return false;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`restaurant ${restaurantId} has malformed manual_override_fields JSON`, { cause: error });
  }
  if (!Array.isArray(parsed) || parsed.some((field) => typeof field !== "string")) {
    throw new Error(`restaurant ${restaurantId} has invalid manual_override_fields`);
  }
  const fields = new Set(parsed);
  return [...fields].some((field) => MANUAL_CUISINE_FIELDS.has(field));
}

async function ensureCuisineType(tx, definition, batchId, typeOperations) {
  const existing = await tx.cuisineType.findUnique({ where: { normalizedName: definition.normalizedName } });
  if (existing) {
    if (existing.status === "active") {
      typeOperations.reused.push(existing);
      return existing;
    }
    const activated = await tx.cuisineType.update({
      where: { id: existing.id },
      data: { name: definition.name, status: "active", createdBy: "ai" },
    });
    typeOperations.reactivated.push(activated);
    return activated;
  }
  let code = definition.code;
  const collision = await tx.cuisineType.findUnique({ where: { code } });
  if (collision) code = `${definition.code}-${crypto.createHash("sha256").update(definition.normalizedName).digest("hex").slice(0, 8)}`;
  const created = await tx.cuisineType.create({
    data: {
      code,
      name: definition.name,
      normalizedName: definition.normalizedName,
      status: "active",
      createdBy: batchId,
    },
  });
  typeOperations.created.push(created);
  return created;
}

function auditDecision(envelope, targetType) {
  const result = envelope.result;
  return {
    applyVersion: APPLY_VERSION,
    source: "ai",
    classificationGroup: "research",
    inputFingerprint: envelope.inputFingerprint,
    sourceReferences: envelope.sourceReferences ?? [],
    confidence: result.confidence,
    promptVersion: envelope.promptVersion || null,
    modelVersion: envelope.modelVersion || null,
    reasonCodes: result.reasonCodes,
    shortReason: result.shortReason,
    selectedCuisineType: {
      id: targetType.id,
      code: targetType.code,
      name: targetType.name,
      normalizedName: targetType.normalizedName,
    },
    proposedNewCuisineType: result.proposedNewCuisineType,
    candidateDecision: result.proposedNewCuisineType ? {
      status: "approved-and-merged-by-normalized-name",
      cuisineTypeId: targetType.id,
    } : null,
    removedTags: result.removedTags,
    addedTags: result.addedTags,
    tagOperationsApplied: false,
    protectedFields: [],
    evidenceUrls: [],
    evidenceTitles: [],
  };
}

async function applyManifest(options) {
  const { manifest, requests } = loadManifest(options.manifestPath);
  assertManifestTarget(manifest, options);
  const envelopes = validatedResultsForManifest(manifest, requests);
  const prisma = new PrismaClient({ datasources: { db: { url: options.database } } });
  try {
    const existingBatch = await prisma.cuisineApplyBatch.findUnique({ where: { id: options.batchId } });
    if (existingBatch) {
      if (existingBatch.status !== "applied") throw new Error(`batch already exists with status ${existingBatch.status}`);
      return verifyManifest(options, prisma);
    }

    const result = await prisma.$transaction(async (tx) => {
      const typeOperations = { created: [], reactivated: [], reused: [] };
      const candidateNames = [...new Set(envelopes.map((envelope) => envelope.result.proposedNewCuisineType?.normalizedName).filter(Boolean))];
      const candidateTypes = new Map();
      for (const normalizedName of candidateNames) {
        const definition = NEW_TYPE_DEFINITIONS.get(normalizedName);
        if (!definition) throw new Error(`unapproved autonomous CuisineType candidate: ${normalizedName}`);
        candidateTypes.set(normalizedName, await ensureCuisineType(tx, definition, options.batchId, typeOperations));
      }
      const activeTypes = await tx.cuisineType.findMany({ where: { status: "active" }, orderBy: { id: "asc" } });
      const activeById = new Map(activeTypes.map((type) => [Number(type.id), type]));
      const rows = await loadRestaurants(tx, requests.map((request) => Number(request.restaurantId)));
      const rowsById = new Map(rows.map((row) => [Number(row.id), row]));
      if (rows.length !== requests.length) throw new Error(`restaurant existence check failed: found ${rows.length}/${requests.length}`);

      const entries = [];
      for (let index = 0; index < requests.length; index += 1) {
        const request = requests[index];
        const envelope = envelopes[index];
        const row = rowsById.get(Number(request.restaurantId));
        if (!row) throw new Error(`restaurant ${request.restaurantId} not found`);
        const currentFingerprint = fingerprintForRestaurant(row, request.input.savedSourceCuisineTypes);
        if (currentFingerprint !== request.inputFingerprint) throw new Error(`restaurant ${request.restaurantId} fingerprint changed`);
        const expectedCuisineTypeId = request.currentDatabaseSnapshot?.cuisineTypeId == null
          ? null
          : Number(request.currentDatabaseSnapshot.cuisineTypeId);
        const liveCuisineTypeId = row.cuisineTypeId == null ? null : Number(row.cuisineTypeId);
        if (liveCuisineTypeId !== expectedCuisineTypeId) {
          throw new Error(`restaurant ${request.restaurantId} cuisineTypeId changed from manifest snapshot`);
        }
        if (request.currentDatabaseSnapshot?.updatedAtUnix != null
          && Number(row.updatedAtUnix) !== Number(request.currentDatabaseSnapshot.updatedAtUnix)) {
          throw new Error(`restaurant ${request.restaurantId} updatedAtUnix changed from manifest snapshot`);
        }
        if (hasCuisineLock(row.manualOverrideFields, request.restaurantId)) throw new Error(`restaurant ${request.restaurantId} has a cuisine manual lock`);
        const classification = envelope.result;
        const targetType = classification.proposedNewCuisineType
          ? candidateTypes.get(classification.proposedNewCuisineType.normalizedName)
          : activeById.get(Number(classification.selectedCuisineTypeId));
        if (!targetType || targetType.status !== "active") throw new Error(`restaurant ${request.restaurantId} has no active CuisineType target`);
        const before = snapshotForRestaurant(row);
        const after = { ...before, cuisineTypeId: Number(targetType.id) };
        entries.push({
          restaurantId: Number(row.id),
          targetType,
          before,
          after,
          changed: Number(before.cuisineTypeId) !== Number(targetType.id),
          audit: auditDecision(envelope, targetType),
        });
      }

      await tx.cuisineApplyBatch.create({
        data: {
          id: options.batchId,
          status: "applying",
          source: "cuisine-classification",
          createdBy: "manual",
        },
      });

      const requestById = new Map(requests.map((request) => [Number(request.restaurantId), request]));
      const changedByTarget = new Map();
      for (const entry of entries.filter((item) => item.changed)) {
        if (!changedByTarget.has(entry.targetType.id)) changedByTarget.set(entry.targetType.id, []);
        changedByTarget.get(entry.targetType.id).push(entry.restaurantId);
      }
      for (const [cuisineTypeId, ids] of changedByTarget) {
        for (const idChunk of chunked(ids)) {
          const updated = await tx.restaurant.updateMany({
            where: { id: { in: idChunk } },
            data: { cuisineTypeId: Number(cuisineTypeId) },
          });
          if (updated.count !== idChunk.length) throw new Error(`update count mismatch for CuisineType ${cuisineTypeId}`);
        }
      }

      for (const entryChunk of chunked(entries, 250)) {
        await tx.cuisineApplyChange.createMany({
          data: entryChunk.map((entry) => ({
            batchId: options.batchId,
            restaurantId: entry.restaurantId,
            inputFingerprint: requestById.get(entry.restaurantId).inputFingerprint,
            beforeJson: JSON.stringify(entry.before),
            afterJson: JSON.stringify(entry.after),
            decisionJson: JSON.stringify(entry.audit),
            actionStatus: entry.changed ? "applied" : "no-change",
            protectedFieldsJson: null,
          })),
        });
      }

      await tx.cuisineApplyBatch.update({ where: { id: options.batchId }, data: { status: "applied" } });
      return {
        updated: entries.filter((entry) => entry.changed).length,
        noChange: entries.filter((entry) => !entry.changed).length,
        createdTypes: typeOperations.created.map((type) => ({ id: type.id, code: type.code, name: type.name })),
        reactivatedTypes: typeOperations.reactivated.map((type) => ({ id: type.id, code: type.code, name: type.name })),
        reusedTypes: typeOperations.reused.map((type) => ({ id: type.id, code: type.code, name: type.name })),
      };
    }, { maxWait: 30_000, timeout: 300_000 });

    const verified = await verifyManifest(options, prisma);
    const summary = { ...verified, newCuisineTypes: result.createdTypes, transaction: result };
    writeJsonAtomic(path.join(path.dirname(manifest.rawResultPath), "apply-summary.json"), summary);
    return summary;
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyManifest(options, suppliedPrisma = null) {
  const { manifest, requests } = loadManifest(options.manifestPath);
  assertManifestTarget(manifest, options);
  const envelopes = validatedResultsForManifest(manifest, requests);
  const prisma = suppliedPrisma ?? new PrismaClient({ datasources: { db: { url: options.database } } });
  try {
    const batch = await prisma.cuisineApplyBatch.findUnique({
      where: { id: options.batchId },
      include: { changes: { orderBy: { restaurantId: "asc" } } },
    });
    if (!batch || batch.status !== "applied") throw new Error("applied audit batch was not found");
    if (batch.source !== "cuisine-classification" || batch.createdBy !== "manual" || batch.rolledBackAt != null) {
      throw new Error("applied audit batch metadata does not match this workflow");
    }
    if (batch.changes.length !== requests.length) throw new Error(`audit coverage mismatch: ${batch.changes.length}/${requests.length}`);
    const changesById = new Map(batch.changes.map((change) => [Number(change.restaurantId), change]));
    const rows = await loadRestaurants(prisma, requests.map((request) => Number(request.restaurantId)));
    const rowsById = new Map(rows.map((row) => [Number(row.id), row]));
    const activeTypes = await prisma.cuisineType.findMany({ where: { status: "active" }, orderBy: { id: "asc" } });
    const activeById = new Map(activeTypes.map((type) => [Number(type.id), type]));
    const candidateByName = new Map(activeTypes.map((type) => [type.normalizedName, type]));
    let updated = 0;
    let noChange = 0;
    let otherCount = 0;
    const failures = [];
    for (let index = 0; index < requests.length; index += 1) {
      const request = requests[index];
      const envelope = envelopes[index];
      const row = rowsById.get(Number(request.restaurantId));
      const change = changesById.get(Number(request.restaurantId));
      const expectedType = envelope.result.proposedNewCuisineType
        ? candidateByName.get(envelope.result.proposedNewCuisineType.normalizedName)
        : activeById.get(Number(envelope.result.selectedCuisineTypeId));
      if (!row || !change || !expectedType) {
        failures.push({ restaurantId: request.restaurantId, reason: "missing row, audit, or target type" });
        continue;
      }
      const initialCuisineTypeId = request.currentDatabaseSnapshot?.cuisineTypeId == null
        ? null
        : Number(request.currentDatabaseSnapshot.cuisineTypeId);
      const expectedActionStatus = initialCuisineTypeId === Number(expectedType.id) ? "no-change" : "applied";
      if (expectedActionStatus === "applied") updated += 1;
      else noChange += 1;
      if (change.inputFingerprint !== request.inputFingerprint) {
        failures.push({ restaurantId: row.id, reason: "audit input fingerprint mismatch" });
      }
      let recordedBefore;
      let recordedAfter;
      let recordedDecision;
      try {
        recordedBefore = JSON.parse(change.beforeJson);
        recordedAfter = JSON.parse(change.afterJson);
        recordedDecision = JSON.parse(change.decisionJson);
      } catch {
        failures.push({ restaurantId: row.id, reason: "audit JSON is malformed" });
        continue;
      }
      const actualSnapshot = snapshotForRestaurant(row);
      const expectedBefore = { ...recordedAfter, cuisineTypeId: initialCuisineTypeId };
      const expectedDecision = auditDecision(envelope, expectedType);
      if (Number(row.cuisineTypeId) !== Number(expectedType.id)) failures.push({ restaurantId: row.id, reason: "CuisineType target mismatch" });
      if (stableJson(actualSnapshot) !== stableJson(recordedAfter)) failures.push({ restaurantId: row.id, reason: "recorded after-state mismatch" });
      if (stableJson(recordedBefore) !== stableJson(expectedBefore)) failures.push({ restaurantId: row.id, reason: "recorded before-state mismatch" });
      if (stableJson(recordedDecision) !== stableJson(expectedDecision)) failures.push({ restaurantId: row.id, reason: "recorded decision mismatch" });
      if (change.actionStatus !== expectedActionStatus) failures.push({ restaurantId: row.id, reason: `action status should be ${expectedActionStatus}` });
      if (change.protectedFieldsJson != null) failures.push({ restaurantId: row.id, reason: "unexpected protected fields audit payload" });
      if (fingerprintForRestaurant(row, request.input.savedSourceCuisineTypes) !== request.inputFingerprint) {
        failures.push({ restaurantId: row.id, reason: "identity/source/tag fingerprint changed" });
      }
      if (request.currentDatabaseSnapshot?.updatedAtUnix != null
        && Number(row.updatedAtUnix) !== Number(request.currentDatabaseSnapshot.updatedAtUnix)) {
        failures.push({ restaurantId: row.id, reason: "updatedAtUnix changed outside this cuisine apply" });
      }
      if (Number(row.cuisineTypeId) === 22) otherCount += 1;
    }
    const integrity = await prisma.$queryRawUnsafe("PRAGMA integrity_check");
    const foreignKeys = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");
    if (integrity?.[0]?.integrity_check !== "ok") failures.push({ restaurantId: null, reason: "SQLite integrity_check failed" });
    if (foreignKeys.length > 0) failures.push({ restaurantId: null, reason: `SQLite foreign_key_check returned ${foreignKeys.length} rows` });
    const createdNames = activeTypes
      .filter((type) => type.createdBy === options.batchId)
      .filter((type) => NEW_TYPE_DEFINITIONS.has(type.normalizedName))
      .map((type) => ({ id: type.id, code: type.code, name: type.name }));
    const summary = {
      batchId: options.batchId,
      status: failures.length === 0 ? "verified" : "failed",
      totalProcessed: requests.length,
      updated,
      noChange,
      otherCuisineCount: otherCount,
      newCuisineTypes: createdNames,
      failures: failures.length,
      failureDetails: failures.slice(0, 50),
      auditChanges: batch.changes.length,
      integrityCheck: integrity?.[0]?.integrity_check ?? null,
      foreignKeyViolations: foreignKeys.length,
      verifiedAt: new Date().toISOString(),
    };
    if (failures.length > 0) throw new Error(`verification failed: ${JSON.stringify(summary)}`);
    if (!suppliedPrisma) writeJsonAtomic(path.join(path.dirname(manifest.rawResultPath), "apply-summary.json"), summary);
    return summary;
  } finally {
    if (!suppliedPrisma) await prisma.$disconnect();
  }
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.command === "classify") return classifyManifest(options);
  if (options.command === "apply") return applyManifest(options);
  return verifyManifest(options);
}

if (require.main === module) {
  main()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      console.error(error instanceof Error ? error.stack || error.message : error);
      process.exitCode = 1;
    });
}

module.exports = {
  NEW_TYPE_DEFINITIONS,
  SOURCE_RULES,
  NAME_RULES,
  chooseCuisine,
  classifyManifest,
  main,
  parseArgs,
  resultForRequest,
};
