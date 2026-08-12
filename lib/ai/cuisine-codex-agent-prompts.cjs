const CODEX_AGENT_PROMPT_VERSION = "cuisine-codex-agent-prompt-v1";

function displayPath(value) {
  return String(value ?? "").trim() || "(未設定)";
}

function commonInstructions({ manifestPath, manifest, stage }) {
  return `你是 JAZAMILA 的資料轉換執行 agent，正在執行 ${stage === "ai" ? "第四階段 AI 結構化分類" : "第五階段低信心 Web 查核"}。

這是受控的 dry-run。你只能處理 manifest 指定的 batch，只能寫入 manifest 指定的輸出 artifact；不可修改 repository 內的程式碼、schema、migration、seed、文件或 SQLite。

執行前必須：
1. 讀取並確認 manifest：${displayPath(manifestPath)}
2. 確認 manifest.readOnly=true、manifest.writesDatabase=false、manifest.stage=${stage}。
3. 確認 requestCount、snapshotHash、promptVersion、modelVersion 與輸入檔一致。
4. 確認工作目錄是 JAZAMILA repository，但不要用 git reset、restore、checkout、clean 或任何覆蓋既有修改的命令。
5. 輸出檔若已存在，只能覆寫 manifest 指定的 generated output；不可 append，也不可寫入其他檔案。

本批固定契約摘要：
- batchId: ${displayPath(manifest.batchId)}
- requestCount: ${manifest.requestCount}
- snapshotHash: ${displayPath(manifest.snapshotHash)}
- promptVersion: ${displayPath(manifest.promptVersion)}
- modelVersion: ${displayPath(manifest.modelVersion)}
- request JSONL: ${displayPath(manifest.requestPath)}
- raw result JSONL: ${displayPath(manifest.rawResultPath)}
- validated result JSONL: ${displayPath(manifest.validatedResultPath)}
`;
}

function buildAiCodexAgentPrompt({ manifestPath, manifest, schemaPath }) {
  return `${commonInstructions({ manifestPath, manifest, stage: "ai" })}

AI 階段限制：
- 不可使用網路、搜尋、瀏覽器、curl、外部 API、OPENAI_API_KEY 或任何 model endpoint。
- 不可自行重新查詢餐廳；只使用 request JSONL 內的 name、address、phone、currentFoodType、currentTags、knownSourceReferences、savedSourceCuisineTypes 與 suppliedCuisineTypes。
- 每一筆 request 的 systemPrompt 與 userPrompt 是該筆的正式提示詞，必須依原文執行，不可改寫其資料。

處理方式：
1. 逐行讀取 ${displayPath(manifest.requestPath)}，每行一筆 request，順序不可改變。
2. 每筆只輸出一個「分類結果物件」，不可輸出 markdown、解釋文字、JSON code fence、customId、status 或其他 envelope 欄位。
3. 結果必須完全符合 schema：${displayPath(schemaPath)}；additionalProperties 不可增加欄位。
4. restaurantId 與 inputFingerprint 必須逐字從該筆 request 複製；不得用另一筆資料代替。
5. selectedCuisineTypeId 與 proposedNewCuisineType 只能擇一；若資料不足，兩者皆為 null、confidence=0、needsWebResearch=true，reasonCodes 必須包含 WEB_RESEARCH_REQUIRED。
6. 只能從 suppliedCuisineTypes 選擇 active 類型；candidate 必須是穩定可重用的大方向，不能是菜名、品牌名、行銷詞或輔助 tag。
7. 人氣、平價、古早味、排隊、聚餐、約會、親子、寵物友善、吃到飽不能成為 CuisineType；咖啡廳、火鍋、燒肉等料理類型也不可留在 keptTags 或 addedTags。
8. addedTags 只有在輸入中已有同義輔助 tag 的明確證據時才能使用；不可創造行銷性 tag。
9. 不可因 tag 排第一個、模型常識或同名店推測不存在的資訊。
10. 只有在所有輸入 tags 都被 keptTags 或 removedTags 覆蓋，且分類證據足夠時，才可輸出高信心結果。

輸出規則：
- 將結果寫成 ${displayPath(manifest.rawResultPath)}。
- 一行一個 JSON 物件，必須與 request 一一對應、順序相同、不可重複或遺漏。
- 不要把最終 JSONL 貼在 agent 回覆中；回覆只需說明已完成或指出無法完成。
- 完成後執行：
  node scripts/validate-cuisine-codex-output.cjs --stage ai --manifest ${displayPath(manifestPath)}
- validator 失敗時不要自行修改正式程式；保留 raw output，回報失敗原因。
`;
}

function buildWebCodexAgentPrompt({ manifestPath, manifest, schemaPath, evidenceSchemaPath }) {
  return `${commonInstructions({ manifestPath, manifest, stage: "web" })}

Web 階段限制：
- 只有 manifest 內的 request 才可查核；不可替其他餐廳搜尋。
- 允許網路查核，但只能對 eligibility.eligible=true 的 request 使用網路；不可用 API key 或本專案的外部 provider runner。
- 每個搜尋必須使用完整名稱、完整地址、城市／行政區、電話（若有）與分店名稱（若有）。
- 搜尋摘要不是證據。必須開啟並讀取完整頁面；無法抓取完整頁面就不得引用。
- 來源優先順序：官方網站／官方菜單、官方社群、可辨認完整地址的店家頁面、可靠平台、一般文章。低層級來源不得覆蓋高信心官方來源。
- 同名不同地址、電話不符、分店不明或來源互相衝突時，回傳 unresolved，不可猜測。
- 不得把評論者主觀詞直接新增為人氣、平價等 tag。

處理方式：
1. 逐行讀取 ${displayPath(manifest.requestPath)}，精確使用每筆 request.searchQueries；不可改寫 searchQueries。
2. 將每筆結果寫成完整的 Web result JSON，必須符合 schema：${displayPath(schemaPath)}。
3. 將每筆已成功抓取的完整頁面證據寫入 sidecar：${displayPath(manifest.evidencePath)}，格式必須符合：${displayPath(evidenceSchemaPath)}。
4. raw result JSONL 與 evidence JSONL 都必須以 customId 對回同一筆 request；restaurantId 與 inputFingerprint 也必須逐字相符。
5. evidence 的 content 必須是實際抓取頁面的文字，contentHash 必須是該 content 的 SHA-256；不可用搜尋摘要代替 content。
6. evidence 的 matchedName、matchedAddress、matchedPhone、identityMatch、sourceTier、sourceKind、supportedTags、cuisineSignals 必須由該頁面實際內容支持。
7. 若沒有足夠證據，raw result 必須 selectedCuisineType=null、proposedNewCuisineType=null、confidence=0、matchConfidence=0、unresolvedReason 非空、evidence=[]；sidecar 的 fetchedSources=[]。
8. 每間餐廳只能選擇一個主要料理類型；addedTags 只能由 evidence.supportedTags 明確支持。

輸出規則：
- 只寫入 manifest 指定的 raw result、evidence 與 validated output 檔案。
- 不要把 JSONL 貼在 agent 回覆中；回覆只需說明已完成或指出無法完成。
- 完成後執行：
  node scripts/validate-cuisine-codex-output.cjs --stage web --manifest ${displayPath(manifestPath)}
- validator 失敗時不要自行修改正式程式；保留 raw output 與 evidence，回報失敗原因。
`;
}

function buildCodexAgentPrompt(options) {
  if (options?.stage === "ai") return buildAiCodexAgentPrompt(options);
  if (options?.stage === "web") return buildWebCodexAgentPrompt(options);
  throw new Error("stage must be ai or web");
}

module.exports = {
  CODEX_AGENT_PROMPT_VERSION,
  buildAiCodexAgentPrompt,
  buildCodexAgentPrompt,
  buildWebCodexAgentPrompt,
};
