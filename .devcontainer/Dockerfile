FROM mcr.microsoft.com/devcontainers/javascript-node:20-bookworm

# 必要に応じてOSパッケージをインストール
RUN apt-get update && apt-get install -y \
    python3-pip \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# 作業ディレクトリの設定
WORKDIR /workspaces/${localWorkspaceFolderBasename}