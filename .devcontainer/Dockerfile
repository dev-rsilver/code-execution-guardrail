FROM node:24-bookworm-slim

# Install standard packages: git, certificates, and process management tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

# [Optional] Set the default user to node
USER node
