const {
  WEB_RESEARCH_PROMPT_VERSION,
  appendFetchedEvidenceContext,
} = require("./web-research-prompts.cjs");
const {
  collectFetchedEvidence,
  publicEvidence,
  sourceConflict,
} = require("./web-research-sources.cjs");
const {
  validateWebResearchResult,
  webResearchJsonSchema,
} = require("./web-research-contract.cjs");

const WEB_RESEARCH_SYSTEM_PROMPT = "僅輸出指定 JSON Schema 的 Web 查核 JSON，不得輸出額外文字。";

class WebResearchProviderAdapter {
  constructor({
    searchImpl,
    fetchImpl,
    modelAdapter,
    maxResultsPerQuery = 5,
    clock = () => new Date(),
  } = {}) {
    this.searchImpl = searchImpl;
    this.fetchImpl = fetchImpl;
    this.modelAdapter = modelAdapter;
    this.maxResultsPerQuery = maxResultsPerQuery;
    this.clock = clock;
  }

  async research(request) {
    if (!request?.eligibility?.eligible) {
      return {
        status: "skipped",
        customId: request.customId,
        attempts: 0,
        errorCode: "NOT_ELIGIBLE",
        errorMessage: "web research was not eligible for this record",
      };
    }
    const collected = await collectFetchedEvidence({
      input: request.input,
      searchQueries: request.searchQueries,
      searchImpl: this.searchImpl,
      fetchImpl: this.fetchImpl,
      maxResultsPerQuery: this.maxResultsPerQuery,
      clock: this.clock,
    });
    const audit = {
      searchQueries: request.searchQueries,
      searchHits: collected.searchHits.map((hit) => ({ query: hit.query, url: hit.url, title: hit.title })),
      fetchedSources: collected.fetchedSources.map(publicEvidence),
      searchErrors: collected.searchErrors,
      fetchErrors: collected.fetchErrors,
      sourceConflict: sourceConflict(collected.fetchedSources),
    };
    if (collected.fetchedSources.length === 0) {
      return {
        status: "unresolved",
        customId: request.customId,
        attempts: 0,
        errorCode: "NO_FETCHED_EVIDENCE",
        errorMessage: "search results did not yield a successfully fetched page",
        audit,
        fetchedSources: [],
      };
    }
    if (!this.modelAdapter || typeof this.modelAdapter.classify !== "function") {
      return {
        status: "error",
        customId: request.customId,
        attempts: 0,
        errorCode: "MODEL_ADAPTER_REQUIRED",
        errorMessage: "a structured web research model adapter is required after page retrieval",
        audit,
        fetchedSources: collected.fetchedSources,
      };
    }
    const modelUserPrompt = appendFetchedEvidenceContext(request.userPrompt, collected.fetchedSources);
    const modelResult = await this.modelAdapter.classify({
      customId: request.customId,
      promptVersion: WEB_RESEARCH_PROMPT_VERSION,
      systemPrompt: WEB_RESEARCH_SYSTEM_PROMPT,
      userPrompt: modelUserPrompt,
      responseSchema: webResearchJsonSchema,
      validationContext: {
        restaurantId: request.restaurantId,
        inputFingerprint: request.inputFingerprint,
        input: request.input,
        currentTags: request.currentTags,
        searchQueries: request.searchQueries,
        suppliedCuisineTypes: request.candidateCuisineTypes,
        fetchedSources: collected.fetchedSources,
      },
      validateResult: validateWebResearchResult,
    });
    return {
      ...modelResult,
      customId: request.customId,
      promptVersion: WEB_RESEARCH_PROMPT_VERSION,
      audit,
      fetchedSources: collected.fetchedSources,
    };
  }
}

module.exports = {
  WEB_RESEARCH_SYSTEM_PROMPT,
  WebResearchProviderAdapter,
};
