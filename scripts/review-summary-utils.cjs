function cleanText(value) {
  return String(value ?? "")
    // eslint-disable-next-line no-control-regex -- Strip control characters from imported review text.
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function normalizeClauseKey(value) {
  return value.normalize("NFKC")
    .replace(/[\s，,。．.、；;：:「」『』（）()【】《》“”‘’"'、]/g, "")
    .toLowerCase();
}

function reviewSummaryToArray(value) {
  const source = Array.isArray(value) ? value.join("；") : cleanText(value);
  let text = cleanText(source);
  let generatedParagraph = false;

  if (/^公開食記整理顯示\s*[，,:：]/u.test(text)) {
    text = text.replace(/^公開食記整理顯示\s*[，,:：]\s*/u, "");
    generatedParagraph = true;
  }
  for (const suffixPattern of [
    /以上為來源頁面的公開摘要整理[，,]未包含完整評論全文。?$/u,
    /原始公開摘要在此處截斷[，,]未包含完整評論全文。?$/u,
  ]) {
    if (suffixPattern.test(text)) {
      text = text.replace(suffixPattern, "").trim();
      generatedParagraph = true;
    }
  }
  if (generatedParagraph) text = text.replace(/。$/u, "").trim();

  const phrasesToRemove = new Set([
    "公開食記整理顯示",
    "以上為來源頁面的公開摘要整理，未包含完整評論全文。",
    "原始公開摘要在此處截斷，未包含完整評論全文。",
    "未包含完整評論全文。",
    "未包含完整評論全文",
  ]);
  const result = [];
  const seen = new Set();
  for (const rawPart of text.split(/[；;]/u)) {
    const part = cleanText(rawPart).replace(/^[；;]+|[；;]+$/gu, "");
    if (!part || phrasesToRemove.has(part) || /^未包含完整評論全文[。.]?$/u.test(part)) continue;
    const key = normalizeClauseKey(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(part);
  }
  return result.length > 0 ? result : ["目前沒有可整理的公開評論摘要。"];
}

function formatPublicFoodDiarySummary(summary) {
  let body = cleanText(summary).replace(/^公開食記摘要\s*[：:]\s*/u, "");
  body = body.replace(/\s*[（(]\s*詳全[\s\S]*$/u, "");
  const truncated = /(?:\.{2,}|…+)\s*$/u.test(body);
  body = body
    .replace(/(?:\.{2,}|…+)/gu, "；")
    .replace(/[；;]+/g, "；")
    .trim();

  const clauses = [];
  const seen = new Set();
  for (const rawClause of body.split("；")) {
    const clause = rawClause
      .trim()
      .replace(/^[，,、。；;\s]+/u, "")
      .replace(/[，,、；;\s]+$/u, "")
      .replace(/\s+/g, " ");
    if (!clause || /^詳全文?$/u.test(clause)) continue;
    const key = normalizeClauseKey(clause);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    clauses.push(clause);
  }
  if (truncated && clauses.length > 1) clauses.pop();
  if (clauses.length === 0) {
    return ["公開食記頁面沒有足夠的文字摘要可供整理。"];
  }
  const ending = truncated
    ? "原始公開摘要在此處截斷，未包含完整評論全文。"
    : "以上為來源頁面的公開摘要整理，未包含完整評論全文。";
  return reviewSummaryToArray(`公開食記整理顯示，${clauses.join("；")}。${ending}`);
}

module.exports = { formatPublicFoodDiarySummary, reviewSummaryToArray };
