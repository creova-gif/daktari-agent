# Google Cloud Run Container for Daktari AI & Gauntlet Runner
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PORT=8080 \
    GAUNTLET_AGENT_ID=daktari-agent-gauntlet

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy project specification and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and execution scripts
COPY . .

RUN chmod +x run.sh run_agent.py

EXPOSE 8080

# Cloud Run entrypoint: serves health probe and accepts execution tasks
ENTRYPOINT ["./run.sh"]
