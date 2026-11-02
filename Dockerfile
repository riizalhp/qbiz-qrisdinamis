# [EMPLOYR PATCH P9] Base image dikunci ke digest (tag debian-2.9.8). Naikkan versinya secara sadar, bukan otomatis.
FROM denoland/deno:debian-2.9.8@sha256:a0d88a7fcbd44f062cba2748e19df67d30290ad12aa203c7c1e0b12462c483f0

# Install chromium and standard dependencies for headless Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Deno environment variables for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy project files
COPY . .

# Build Tailwind CSS & Pre-cache dependencies
RUN deno task build:css
RUN deno cache main.tsx

EXPOSE 8000

# Start server
CMD ["run", "-A", "--env", "main.tsx"]
