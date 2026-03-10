FROM docker.io/cloudflare/sandbox:0.7.0

# Install Node.js 22 (required by OpenClaw) and rclone (for R2 persistence)
# The base image has Node 20, we need to replace it with Node 22
# Using direct binary download for reliability
ENV NODE_VERSION=22.13.1
RUN ARCH="$(dpkg --print-architecture)" \
    && case "${ARCH}" in \
         amd64) NODE_ARCH="x64" ;; \
         arm64) NODE_ARCH="arm64" ;; \
         *) echo "Unsupported architecture: ${ARCH}" >&2; exit 1 ;; \
       esac \
    && apt-get update && apt-get install -y xz-utils ca-certificates rclone \
    && curl -fsSLk https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && node --version \
    && npm --version

# Install pnpm globally
RUN npm install -g pnpm

# Install OpenClaw (formerly clawdbot/moltbot)
# Pin to specific version for reproducible builds
RUN npm install -g openclaw@2026.2.3 \
    && openclaw --version

# Install LINE channel plugin (optional; enables LINE webhook when LINE_* env vars are set)
RUN openclaw plugins install @openclaw/line 2>/dev/null || echo "LINE plugin not available, skip"

# Create OpenClaw directories
# Legacy .clawdbot paths are kept for R2 backup migration
RUN mkdir -p /root/.openclaw \
    && mkdir -p /root/clawd \
    && mkdir -p /root/clawd/skills

# Copy startup script
# Build cache bust: 2026-03-06-v32-verify-script
COPY start-openclaw.sh /usr/local/bin/start-openclaw.sh
RUN chmod +x /usr/local/bin/start-openclaw.sh \
    && test -f /usr/local/bin/start-openclaw.sh || (echo "ERROR: start-openclaw.sh not found" && exit 1)
# Unique layer per build so image tag changes and push is not skipped
RUN date -Iseconds > /tmp/moltworker-build-id && cat /tmp/moltworker-build-id

# Copy custom skills
COPY skills/ /root/clawd/skills/

# Set working directory
WORKDIR /root/clawd

# Expose the gateway port
EXPOSE 18789
