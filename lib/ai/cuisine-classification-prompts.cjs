const crypto = require("node:crypto");

const PROMPT_VERSION = "cuisine-ai-prompt-v1";
const SYSTEM_PROMPT = `你是餐廳分類資料整理器。

每間餐廳只能選擇一個主要料理類型。

「料理類型」是餐廳主要提供餐飲的大方向分類，例如日式料理、中式料理、韓式料理、火鍋、燒肉、咖啡廳。

「輔助標籤」是不能單獨代表主要料理方向的細節，例如吃到飽、人氣、平價、古早味、聚餐、約會、親子、寵物友善。

你的優先順序：

1. 只從 suppliedCuisineTypes 選擇適用的唯一料理類型。
2. 若沒有任何現有類型適用，才提出 proposedNewCuisineType。
3. proposedNewCuisineType 必須是穩定、可重用的大分類，不能是單一菜名、品牌名、行銷詞或過度細分描述。
4. 從 tags 中移除與料理類型同義或屬於主要餐飲分類的項目。
5. 保留真正的輔助 tags。
6. 只有輸入證據明確支持時才能新增 tag。
7. 資料不足或存在分店誤配風險時，設定 needsWebResearch=true。
8. 不可只因 tag 排在第一項就認定它是料理類型。
9. 不可把人氣、平價、古早味、聚餐、排隊等輔助詞當成料理類型。
10. 僅輸出符合指定 JSON Schema 的資料。`;

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function promptFingerprint(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

function jsonForPrompt(value) {
  return JSON.stringify(value ?? [], null, 2);
}

function buildUserPrompt({
  restaurantId,
  name,
  address,
  phone,
  currentFoodType,
  currentTags,
  suppliedCuisineTypes,
  knownSourceReferences,
  savedSourceCuisineTypes = [],
}) {
  const sourcePayload = {
    references: knownSourceReferences ?? [],
    savedCuisineTypes: savedSourceCuisineTypes ?? [],
  };
  return `請分類以下餐廳：

restaurantId:
${restaurantId}

name:
${name ?? ""}

address:
${address ?? ""}

phone:
${phone ?? ""}

currentFoodType:
${currentFoodType ?? 0}

currentTags:
${jsonForPrompt(currentTags)}

suppliedCuisineTypes:
${jsonForPrompt(suppliedCuisineTypes)}

knownSourceReferences:
${jsonForPrompt(sourcePayload)}

請選出唯一料理類型，整理輔助 tags，並判斷是否需要網路查核。`;
}

function buildPromptBundle(input) {
  const systemPrompt = SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(input);
  return {
    promptVersion: PROMPT_VERSION,
    systemPrompt,
    userPrompt,
    systemPromptFingerprint: promptFingerprint(systemPrompt),
    userPromptFingerprint: promptFingerprint(userPrompt),
  };
}

module.exports = {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  buildPromptBundle,
  buildUserPrompt,
  promptFingerprint,
};
