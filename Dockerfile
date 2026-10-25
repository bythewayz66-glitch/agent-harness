# Agent Harness — LLM proxy + static app
# Build:  docker build -t agent-harness .
# Run:    docker run -p 8091:8091 -e PORT=8091 agent-harness
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PORT=8091

WORKDIR /app

# stdlib only — no pip installs required
COPY harness_server.py index.html styles.css app.js ./
COPY dist/ ./dist/

EXPOSE 8091

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD python -c "import urllib.request,os;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8091')+'/api/llm/status',timeout=4)"

CMD ["python", "harness_server.py"]
