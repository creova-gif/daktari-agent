# Container for Daktari Agent & MCP Triage Runner
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PORT=8080 \
    GAUNTLET_AGENT_ID=daktari-agent-gauntlet

# Install system dependencies and create unprivileged runtime user
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 daktari \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin daktari

# Copy project specification and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and execution scripts
COPY . .
RUN chmod +x run.sh run_agent.py && chown -R daktari:daktari /app

USER daktari

EXPOSE 8080

# Entrypoint: serves health probe and accepts MCP/triage execution tasks
ENTRYPOINT ["./run.sh"]
