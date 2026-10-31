# 本仓库改动说明

本仓库基于 [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV) 修改，新增了面向国内 IPTV 场景的直播源兼容性增强。

## 改动内容

### 1. 直播源格式兼容增强

| 文件 | 改动 |
|---|---|
| `src/lib/m3u-parser.ts` | 新增 txt 频道列表解析：支持 `名称,URL` 逗号格式与 `#genre#` / `#group#` 分组 |
| `src/lib/tvbox-parser.ts` | 放行 `.txt` 直播源（原版直接跳过） |
| `src/app/api/live/detect/route.ts` | 新增服务端直播流格式探测接口 |

### 2. 直播播放器引擎增强

| 文件 | 改动 |
|---|---|
| `src/components/live-player.tsx` | 支持 MPEG-TS 裸流播放（mpegts.js）；无后缀直播源通过服务端探测 Content-Type 自动选择 hls / mpegts 引擎 |

**核心能力**：
- 无后缀 TS 流（如组播转单播的 `http://host:port/频道路径`）→ 秒播
- 无后缀 HLS 流（如 302 重定向到 m3u8 的中转源）→ 正常播放
- 两种格式相反的源通过**服务端 Content-Type 探测**自动区分，互不干扰

## 使用方式

### 部署

```bash
# 新建目录，保存下方 compose.yml 后直接拉镜像启动（无需源码）
mkdir libretv && cd libretv
# 将下方 compose.yml 保存为 compose.yml
docker compose up -d
```

### 完整 compose.yml（拉取镜像，带 15 个点播源）

将以下内容保存为 `compose.yml`：

```yaml
services:
  libretv:
    # 拉取 GitHub Actions 构建好的镜像（无需本地源码）
    image: ghcr.io/wgsjjj/libretv:latest
    container_name: libretv
    restart: unless-stopped
    ports:
      - "8088:8080"
    environment:
      # 必填：访问密码
      - PASSWORD=123456
      # 允许访问内网自建 IPTV（组播转单播、rtp2httpd 等内网流）
      - LIVE_ALLOW_PRIVATE=1
      # 预置点播源（Apple CMS 采集站，15 个实测可用）
      - DEFAULT_SOURCES=[{"name":"iKun资源","url":"https://ikunzyapi.com/api.php/provide/vod"},{"name":"光速资源","url":"https://api.guangsuapi.com/api.php/provide/vod"},{"name":"最大资源","url":"https://api.zuidapi.com/api.php/provide/vod"},{"name":"新浪资源","url":"https://api.xinlangapi.com/xinlangapi.php/provide/vod"},{"name":"无尽资源","url":"https://api.wujinapi.me/api.php/provide/vod"},{"name":"暴风资源","url":"https://bfzyapi.com/api.php/provide/vod"},{"name":"极速资源","url":"https://jszyapi.com/api.php/provide/vod"},{"name":"樱花资源","url":"https://m3u8.apiyhzy.com/api.php/provide/vod"},{"name":"猫眼资源","url":"https://api.maoyanapi.top/api.php/provide/vod"},{"name":"茅台资源","url":"https://caiji.maotaizy.cc/api.php/provide/vod"},{"name":"豪华资源","url":"https://hhzyapi.com/api.php/provide/vod"},{"name":"非凡影视","url":"https://cj.ffzyapi.com/api.php/provide/vod"},{"name":"U酷影视","url":"https://api.ukuapi88.com/api.php/provide/vod"},{"name":"量子资源","url":"http://cj.lziapi.com/api.php/provide/vod"},{"name":"如意资源","url":"https://cj.rycjapi.com/api.php/provide/vod/"}]
      # 预置直播源（取消注释并填入你的直播源地址）
      # - DEFAULT_LIVE_SOURCES=[{"name":"你的直播源","url":"http://example.com/list.m3u"}]
```

### 直播源添加

在网页界面「设置 → 源管理 → 直播源」中填入以下任意格式：

- M3U 播放列表：`http://host/list.m3u`
- txt 频道列表：`http://host/list.txt`（`名称,URL` 格式）
- 无后缀 TS 流 / 302 中转流

## 已知限制

- **H.265/HEVC 编码的频道**在无 HEVC 硬解的浏览器（Chrome/Firefox、未装扩展的 Edge）中无法解码，表现为「只有声音没有画面」。这是浏览器解码能力限制，非本仓库问题。解决方式：为 Edge 安装「HEVC 视频扩展」，或改用带 H.265 解码的播放器（VLC 等）。
- iOS Safari 17.0 及以下不支持 mpegts.js（Media Source Extensions 限制）。

## 许可

沿用上游 [AGPL-3.0](./LICENSE) 许可。
