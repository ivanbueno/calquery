window.RAG_CHATBOT_CONFIG = {
  "generated_at": "2026-02-18T07:20:13.781004+00:00",
  "orchestrator": {
    "function_name": "rag-chatbot-orchestrator-router",
    "function_url": "https://4rl3gclyw766mwtnzt5ynjxl540qaqcb.lambda-url.us-east-1.on.aws/"
  },
  "routes": [
    {
      "index": "selfhelp",
      "source_file": "selfhelp.csv",
      "function_name": "rag-chatbot-selfhelp",
      "function_url": "https://4x777mx4jjpc7gdbofmcvh7i7y0cgrek.lambda-url.us-east-1.on.aws/",
      "description": "Index selfhelp: 2402 rows from selfhelp.csv. categories: Civil, Divorce, Small Claims. primary host: selfhelp.courts.ca.gov. example topics: Learn your options; You were served divorce papers.",
      "sample_queries": [
        "Summarize key themes in selfhelp.",
        "List notable entries from selfhelp.",
        "What are the top categories in selfhelp?"
      ]
    }
  ]
};
