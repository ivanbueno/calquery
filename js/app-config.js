window.RAG_CHATBOT_CONFIG = {
  "generated_at": "2026-03-14T10:37:48.356736+00:00",
  "orchestrator": {
    "function_name": "rag-chatbot-orchestrator-router",
    "function_url": "https://klkjzh4loqdx7dix6l4iknas2a0isbnx.lambda-url.us-east-1.on.aws/"
  },
  "routes": [
    {
      "index": "jcc",
      "source_file": "jcc.csv",
      "function_name": "rag-chatbot-jcc",
      "function_url": "https://c2ra764g4yrqhfnkjrth2bx7za0xhnbi.lambda-url.us-east-1.on.aws/",
      "description": "Index jcc: 18879 rows from jcc.csv. categories: Rules, Civil, Judge. primary host: supreme.courts.ca.gov. example topics: Learn your options; You were served divorce papers.",
      "sites": [
        "Judicial Council",
        "Newsroom",
        "Self Help",
        "Supreme Court"
      ],
      "sample_queries": [
        "Summarize key themes in jcc.",
        "List notable entries from jcc.",
        "What are the top categories in jcc?"
      ]
    }
  ],
  "analytics": {
    "google_tag_id": "G-LQ2FHK8V2Y"
  }
};
