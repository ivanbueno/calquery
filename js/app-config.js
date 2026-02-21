window.RAG_CHATBOT_CONFIG = {
  "generated_at": "2026-02-21T08:22:02.937848+00:00",
  "orchestrator": {
    "function_name": "rag-chatbot-orchestrator-router",
    "function_url": "https://7l4kabvoccado2jm2hvlqbrfpu0bfjeo.lambda-url.us-east-1.on.aws/"
  },
  "routes": [
    {
      "index": "jcc",
      "source_file": "jcc.csv",
      "function_name": "rag-chatbot-jcc",
      "function_url": "https://fiqbsmrdn62rnt4ae23wx7xhay0voqbo.lambda-url.us-east-1.on.aws/",
      "description": "Index jcc: 3749 rows from jcc.csv. categories: Rules, Civil, Judge. primary host: courts.ca.gov. example topics: Learn your options; You were served divorce papers.",
      "sites": [
        "Judicial Council",
        "Self Help"
      ],
      "sample_queries": [
        "Summarize key themes in jcc.",
        "List notable entries from jcc.",
        "What are the top categories in jcc?"
      ]
    }
  ]
};
