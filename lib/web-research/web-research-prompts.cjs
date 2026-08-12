const crypto = require("node:crypto");

const WEB_RESEARCH_PROMPT_VERSION = "cuisine-web-research-prompt-v1";

const WEB_RESEARCH_PROMPT = `請查核指定餐廳的主要料理類型與可證實的輔助標籤。

餐廳：
- 名稱：{{name}}
- 地址：{{address}}
- 電話：{{phone}}
- 現有 tags：{{currentTags}}
- 候選料理類型：{{candidateCuisineTypes}}

要求：

1. 必須確認搜尋結果對應相同名稱與相同地址，或有其他足夠證據確認為同一分店。
2. 每間餐廳只能選擇一個主要料理類型。
3. 優先選擇既有料理類型。
4. 若沒有適用類型，只能提出一個穩定且可重用的新類型候選。
5. Tag 只保留輔助特徵。
6. 只有來源明確支持時才能新增 tag。
7. 若無法確認同一間餐廳，回傳 unresolved，不可猜測。
8. 回傳完整來源 URL、來源標題及查核日期。
9. 僅輸出指定 JSON Schema。`;

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

function json(value) {
  return JSON.stringify(value ?? [], null, 2);
}

function buildWebResearchUserPrompt({ name, address, phone, currentTags, candidateCuisineTypes }) {
  return WEB_RESEARCH_PROMPT
    .replace("{{name}}", name ?? "")
    .replace("{{address}}", address ?? "")
    .replace("{{phone}}", phone ?? "")
    .replace("{{currentTags}}", json(currentTags))
    .replace("{{candidateCuisineTypes}}", json(candidateCuisineTypes));
}

function buildWebResearchPromptBundle(input) {
  const userPrompt = buildWebResearchUserPrompt(input);
  return {
    promptVersion: WEB_RESEARCH_PROMPT_VERSION,
    userPrompt,
    userPromptFingerprint: fingerprint(userPrompt),
  };
}

function appendFetchedEvidenceContext(userPrompt, sources) {
  const context = (Array.isArray(sources) ? sources : []).map((source) => ({
    url: source.url,
    title: source.title,
    sourceTier: source.sourceTier,
    sourceKind: source.sourceKind,
    contentHash: source.contentHash,
    content: String(source.content ?? "").slice(0, 12000),
  }));
  return `${userPrompt}\n\n已擷取來源（只有已成功抓取的頁面可作為 evidence；搜尋摘要不可單獨作為證據）：\n${json(context)}`;
}

module.exports = {
  WEB_RESEARCH_PROMPT,
  WEB_RESEARCH_PROMPT_VERSION,
  appendFetchedEvidenceContext,
  buildWebResearchPromptBundle,
  buildWebResearchUserPrompt,
};
