FROM node:20-bookworm-slim

# Cài đặt các thư viện hệ thống cần thiết cho FFmpeg, Chromium (Puppeteer) và Bộ font Tiếng Việt đầy đủ
RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-dejavu-core \
    fonts-roboto \
    fonts-freefont-ttf \
    fontconfig \
    ca-certificates \
    wget \
    curl \
    unzip \
    python3 \
    locales \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && curl -fsSL https://deno.land/x/install/install.sh | sh \
    && mv /root/.deno/bin/deno /usr/local/bin/deno \
    && chmod a+rx /usr/local/bin/deno \
    && mkdir -p /usr/share/fonts/truetype/google \
    && wget -q -O /usr/share/fonts/truetype/google/Montserrat-Bold.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/static/Montserrat-Bold.ttf" || true \
    && wget -q -O /usr/share/fonts/truetype/google/Montserrat-SemiBold.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/static/Montserrat-SemiBold.ttf" || true \
    && wget -q -O /usr/share/fonts/truetype/google/Montserrat-Regular.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/static/Montserrat-Regular.ttf" || true \
    && wget -q -O /usr/share/fonts/truetype/google/PlusJakartaSans-Bold.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/static/PlusJakartaSans-Bold.ttf" || true \
    && wget -q -O /usr/share/fonts/truetype/google/PlusJakartaSans-SemiBold.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/static/PlusJakartaSans-SemiBold.ttf" || true \
    && wget -q -O /usr/share/fonts/truetype/google/PlusJakartaSans-Regular.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/static/PlusJakartaSans-Regular.ttf" || true \
    && wget -q -O /usr/share/fonts/truetype/google/Inter-Bold.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter_24pt-Bold.ttf" || true \
    && wget -q -O /usr/share/fonts/truetype/google/Inter-Regular.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter_24pt-Regular.ttf" || true \
    && echo '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><match target="pattern"><test qual="any" name="family"><string>sans-serif</string></test><edit name="family" mode="prepend" binding="strong"><string>Montserrat</string><string>Plus Jakarta Sans</string><string>Inter</string><string>Noto Sans</string><string>Roboto</string><string>DejaVu Sans</string></edit></match><match target="pattern"><test qual="any" name="family"><string>Liberation Sans</string></test><edit name="family" mode="assign" binding="strong"><string>Noto Sans</string></edit></match></fontconfig>' > /etc/fonts/local.conf \
    && fc-cache -fv \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer executable path to the installed chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Set UTF-8 locale for Vietnamese character support
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Tạo thư mục app
WORKDIR /usr/src/app

# Sao chép file gốc
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Cài đặt dependencies
RUN npm install --legacy-peer-deps

# Copy toàn bộ mã nguồn
COPY . .

# Generate Prisma Client
WORKDIR /usr/src/app/apps/api
RUN npx prisma generate

# Build ứng dụng NestJS
RUN npm run build

# Port ứng dụng chạy
EXPOSE 3000

# Khởi chạy API
CMD ["npm", "run", "start:prod"]
