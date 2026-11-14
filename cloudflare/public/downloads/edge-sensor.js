var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../signatures/ai-bots.json
var ai_bots_default = {
  version: 1,
  matching: "first match in file order, case-insensitive regex on User-Agent",
  bots: [
    {
      id: "oai-searchbot",
      name: "OAI-SearchBot",
      operator: "OpenAI",
      kind: "ai",
      purpose: "indexing",
      ua: "OAI-SearchBot",
      robots: "OAI-SearchBot",
      ipSources: [
        "https://openai.com/searchbot.json"
      ],
      docs: "https://developers.openai.com/api/docs/bots"
    },
    {
      id: "oai-adsbot",
      name: "OAI-AdsBot",
      operator: "OpenAI",
      kind: "ai",
      purpose: "unknown",
      ua: "OAI-AdsBot",
      robots: "OAI-AdsBot",
      ipSources: [],
      docs: "https://developers.openai.com/api/docs/bots"
    },
    {
      id: "chatgpt-user",
      name: "ChatGPT-User",
      operator: "OpenAI",
      kind: "ai",
      purpose: "retrieval",
      ua: "ChatGPT-User",
      robots: "ChatGPT-User",
      ipSources: [
        "https://openai.com/chatgpt-user.json"
      ],
      docs: "https://developers.openai.com/api/docs/bots"
    },
    {
      id: "gptbot",
      name: "GPTBot",
      operator: "OpenAI",
      kind: "ai",
      purpose: "training",
      ua: "GPTBot",
      robots: "GPTBot",
      ipSources: [
        "https://openai.com/gptbot.json"
      ],
      docs: "https://developers.openai.com/api/docs/bots"
    },
    {
      id: "claude-searchbot",
      name: "Claude-SearchBot",
      operator: "Anthropic",
      kind: "ai",
      purpose: "indexing",
      ua: "Claude-SearchBot",
      robots: "Claude-SearchBot",
      ipSources: [],
      docs: "https://support.claude.com/en/articles/8896518"
    },
    {
      id: "claude-user",
      name: "Claude-User",
      operator: "Anthropic",
      kind: "ai",
      purpose: "retrieval",
      ua: "Claude-User",
      robots: "Claude-User",
      ipSources: [],
      docs: "https://support.claude.com/en/articles/8896518"
    },
    {
      id: "claudebot",
      name: "ClaudeBot",
      operator: "Anthropic",
      kind: "ai",
      purpose: "training",
      ua: "ClaudeBot",
      robots: "ClaudeBot",
      ipSources: [],
      docs: "https://support.claude.com/en/articles/8896518"
    },
    {
      id: "anthropic-ai",
      name: "anthropic-ai",
      operator: "Anthropic",
      kind: "ai",
      purpose: "training",
      ua: "anthropic-ai|Claude-Web",
      robots: "anthropic-ai",
      ipSources: [],
      docs: "https://support.claude.com/en/articles/8896518"
    },
    {
      id: "perplexity-user",
      name: "Perplexity-User",
      operator: "Perplexity",
      kind: "ai",
      purpose: "retrieval",
      ua: "Perplexity-User",
      robots: "Perplexity-User",
      ipSources: [
        "https://www.perplexity.ai/perplexity-user.json"
      ],
      docs: "https://docs.perplexity.ai/guides/bots"
    },
    {
      id: "perplexitybot",
      name: "PerplexityBot",
      operator: "Perplexity",
      kind: "ai",
      purpose: "indexing",
      ua: "PerplexityBot",
      robots: "PerplexityBot",
      ipSources: [
        "https://www.perplexity.ai/perplexitybot.json"
      ],
      docs: "https://docs.perplexity.ai/guides/bots"
    },
    {
      id: "google-cloudvertexbot",
      name: "Google-CloudVertexBot",
      operator: "Google",
      kind: "ai",
      purpose: "training",
      ua: "Google-CloudVertexBot",
      robots: "Google-CloudVertexBot",
      ipSources: [],
      docs: "https://developers.google.com/crawling/docs/crawlers-fetchers"
    },
    {
      id: "googleother",
      name: "GoogleOther",
      operator: "Google",
      kind: "ai",
      purpose: "unknown",
      ua: "GoogleOther",
      robots: "GoogleOther",
      ipSources: [],
      docs: "https://developers.google.com/crawling/docs/crawlers-fetchers"
    },
    {
      id: "bytespider",
      name: "Bytespider",
      operator: "ByteDance",
      kind: "ai",
      purpose: "training",
      ua: "Bytespider",
      robots: "Bytespider",
      ipSources: [],
      docs: "https://developers.cloudflare.com/ai-crawl-control/reference/bots/"
    },
    {
      id: "ccbot",
      name: "CCBot",
      operator: "Common Crawl",
      kind: "ai",
      purpose: "training",
      ua: "CCBot",
      robots: "CCBot",
      ipSources: [],
      docs: "https://commoncrawl.org/ccbot"
    },
    {
      id: "meta-externalfetcher",
      name: "Meta-ExternalFetcher",
      operator: "Meta",
      kind: "ai",
      purpose: "retrieval",
      ua: "meta-externalfetcher",
      robots: "meta-externalfetcher",
      ipSources: [],
      docs: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers"
    },
    {
      id: "meta-externalagent",
      name: "Meta-ExternalAgent",
      operator: "Meta",
      kind: "ai",
      purpose: "training",
      ua: "meta-externalagent",
      robots: "meta-externalagent",
      ipSources: [],
      docs: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers"
    },
    {
      id: "facebookbot",
      name: "FacebookBot",
      operator: "Meta",
      kind: "ai",
      purpose: "training",
      ua: "FacebookBot",
      robots: "FacebookBot",
      ipSources: [],
      docs: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers"
    },
    {
      id: "amazonbot",
      name: "Amazonbot",
      operator: "Amazon",
      kind: "ai",
      purpose: "training",
      ua: "Amazonbot",
      robots: "Amazonbot",
      ipSources: [],
      docs: "https://developer.amazon.com/amazonbot"
    },
    {
      id: "applebot",
      name: "Applebot",
      operator: "Apple",
      kind: "ai",
      purpose: "indexing",
      ua: "Applebot",
      robots: "Applebot",
      ipSources: [
        "https://search.developer.apple.com/applebot.json"
      ],
      docs: "https://support.apple.com/en-us/119829"
    },
    {
      id: "duckassistbot",
      name: "DuckAssistBot",
      operator: "DuckDuckGo",
      kind: "ai",
      purpose: "retrieval",
      ua: "DuckAssistBot",
      robots: "DuckAssistBot",
      ipSources: [],
      docs: "https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot"
    },
    {
      id: "mistralai-user",
      name: "MistralAI-User",
      operator: "Mistral",
      kind: "ai",
      purpose: "retrieval",
      ua: "MistralAI-User",
      robots: "MistralAI-User",
      ipSources: [],
      docs: "https://docs.mistral.ai/"
    },
    {
      id: "cohere",
      name: "Cohere",
      operator: "Cohere",
      kind: "ai",
      purpose: "training",
      ua: "cohere-ai|cohere-training-data-crawler",
      robots: "cohere-ai",
      ipSources: [],
      docs: "https://docs.cohere.com/"
    },
    {
      id: "youbot",
      name: "YouBot",
      operator: "You.com",
      kind: "ai",
      purpose: "indexing",
      ua: "YouBot",
      robots: "YouBot",
      ipSources: [],
      docs: "https://about.you.com/youbot/"
    },
    {
      id: "diffbot",
      name: "Diffbot",
      operator: "Diffbot",
      kind: "ai",
      purpose: "training",
      ua: "Diffbot",
      robots: "Diffbot",
      ipSources: [],
      docs: "https://docs.diffbot.com/"
    },
    {
      id: "imagesiftbot",
      name: "ImagesiftBot",
      operator: "Imagesift",
      kind: "ai",
      purpose: "training",
      ua: "ImagesiftBot",
      robots: "ImagesiftBot",
      ipSources: [],
      docs: "https://imagesift.com/about"
    },
    {
      id: "omgili",
      name: "Omgili",
      operator: "Webz.io",
      kind: "ai",
      purpose: "training",
      ua: "omgili(bot)?",
      robots: "omgilibot",
      ipSources: [],
      docs: "https://webz.io/bot.html"
    },
    {
      id: "ai2bot",
      name: "Ai2Bot",
      operator: "Allen Institute for AI",
      kind: "ai",
      purpose: "training",
      ua: "Ai2Bot",
      robots: "Ai2Bot",
      ipSources: [],
      docs: "https://allenai.org/crawler"
    },
    {
      id: "googlebot",
      name: "Googlebot",
      operator: "Google",
      kind: "search",
      purpose: "indexing",
      ua: "Googlebot",
      robots: "Googlebot",
      ipSources: [
        "https://developers.google.com/static/search/apis/ipranges/googlebot.json"
      ],
      docs: "https://developers.google.com/crawling/docs/crawlers-fetchers"
    },
    {
      id: "bingbot",
      name: "Bingbot",
      operator: "Microsoft",
      kind: "search",
      purpose: "indexing",
      ua: "bingbot",
      robots: "bingbot",
      ipSources: [
        "https://www.bing.com/toolbox/bingbot.json"
      ],
      docs: "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0"
    },
    {
      id: "duckduckbot",
      name: "DuckDuckBot",
      operator: "DuckDuckGo",
      kind: "search",
      purpose: "indexing",
      ua: "DuckDuckBot",
      robots: "DuckDuckBot",
      ipSources: [
        "https://duckduckgo.com/duckduckbot.json"
      ],
      docs: "https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot"
    },
    {
      id: "yandexbot",
      name: "YandexBot",
      operator: "Yandex",
      kind: "search",
      purpose: "indexing",
      ua: "YandexBot",
      robots: "YandexBot",
      ipSources: [],
      docs: "https://yandex.com/support/webmaster/robot-workings/"
    },
    {
      id: "baiduspider",
      name: "Baiduspider",
      operator: "Baidu",
      kind: "search",
      purpose: "indexing",
      ua: "Baiduspider",
      robots: "Baiduspider",
      ipSources: [],
      docs: "https://www.baidu.com/search/robots_english.html"
    },
    {
      id: "petalbot",
      name: "PetalBot",
      operator: "Huawei",
      kind: "search",
      purpose: "indexing",
      ua: "PetalBot",
      robots: "PetalBot",
      ipSources: [],
      docs: "https://webmaster.petalsearch.com/site/petalbot"
    },
    {
      id: "facebookexternalhit",
      name: "Facebook link preview",
      operator: "Meta",
      kind: "social",
      purpose: "unknown",
      ua: "facebookexternalhit",
      robots: "facebookexternalhit",
      ipSources: [],
      docs: "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers"
    },
    {
      id: "twitterbot",
      name: "Twitterbot",
      operator: "X",
      kind: "social",
      purpose: "unknown",
      ua: "Twitterbot/",
      robots: "Twitterbot",
      ipSources: [],
      docs: "https://developer.x.com/en/docs/x-for-websites/cards/guides/getting-started"
    },
    {
      id: "linkedinbot",
      name: "LinkedInBot",
      operator: "LinkedIn",
      kind: "social",
      purpose: "unknown",
      ua: "LinkedInBot",
      robots: "LinkedInBot",
      ipSources: [],
      docs: "https://www.linkedin.com/help/linkedin/answer/a521928"
    },
    {
      id: "slackbot",
      name: "Slackbot",
      operator: "Slack",
      kind: "social",
      purpose: "unknown",
      ua: "Slackbot|Slack-ImgProxy",
      robots: "Slackbot",
      ipSources: [],
      docs: "https://api.slack.com/robots"
    },
    {
      id: "discordbot",
      name: "Discordbot",
      operator: "Discord",
      kind: "social",
      purpose: "unknown",
      ua: "Discordbot",
      robots: "Discordbot",
      ipSources: [],
      docs: "https://discord.com/"
    },
    {
      id: "telegrambot",
      name: "TelegramBot",
      operator: "Telegram",
      kind: "social",
      purpose: "unknown",
      ua: "TelegramBot",
      robots: "TelegramBot",
      ipSources: [],
      docs: "https://core.telegram.org/bots"
    },
    {
      id: "whatsapp",
      name: "WhatsApp link preview",
      operator: "Meta",
      kind: "social",
      purpose: "unknown",
      ua: "^WhatsApp/",
      robots: "WhatsApp",
      ipSources: [],
      docs: "https://www.whatsapp.com/"
    }
  ]
};

// ../src/registry.ts
var BOTS = ai_bots_default.bots;
var COMPILED = BOTS.map((bot) => ({ bot, re: new RegExp(bot.ua, "i") }));

// ../src/detect.ts
var MAX_UA = 512;
var GENERIC = /[a-z]bot\b|\bbot\b|\b(crawler|spider|scraper|fetcher|indexer)\b/i;
var toMatch = /* @__PURE__ */ __name((b) => ({
  id: b.id,
  name: b.name,
  operator: b.operator,
  kind: b.kind,
  purpose: b.purpose,
  ipSources: b.ipSources
}), "toMatch");
function detect(userAgent) {
  if (!userAgent) return null;
  const ua = userAgent.slice(0, MAX_UA);
  for (const { bot, re } of COMPILED) if (re.test(ua)) return toMatch(bot);
  if (GENERIC.test(ua)) {
    return { id: "generic-bot", name: "Other crawler", operator: "Unknown", kind: "other", purpose: "unknown", ipSources: [] };
  }
  return null;
}
__name(detect, "detect");

// ../src/sensor.ts
async function handleSensor(request, env, ctx, origin = (r) => fetch(r), send = fetch) {
  let isBot = false;
  try {
    isBot = detect(request.headers.get("user-agent")) !== null;
  } catch {
  }
  const response = await origin(request);
  if (!isBot) return response;
  ctx.waitUntil((async () => {
    try {
      const url = new URL(request.url);
      const cf = request.cf;
      await send(`${env.TRACKER_URL.replace(/\/+$/, "")}/api/ingest`, {
        method: "POST",
        signal: AbortSignal.timeout(5e3),
        headers: { authorization: `Bearer ${env.TRACKER_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          ip: request.headers.get("cf-connecting-ip"),
          ua: request.headers.get("user-agent") ?? "",
          path: url.pathname,
          method: request.method,
          status: response.status,
          referer: request.headers.get("referer") ?? void 0,
          country: cf?.country,
          asn: cf?.asn,
          asOrg: cf?.asOrganization
        })
      });
    } catch (err) {
      console.error(JSON.stringify({ msg: "sensor_report_failed", error: String(err) }));
    }
  })());
  return response;
}
__name(handleSensor, "handleSensor");

// src/index.ts
var index_default = {
  fetch: /* @__PURE__ */ __name((request, env, ctx) => handleSensor(request, env, ctx), "fetch")
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
