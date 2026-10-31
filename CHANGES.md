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
git clone https://github.com/wgsjjj/LibreTV.git
cd LibreTV

# 将下方 compose.yml 保存到本目录（或使用仓库自带 docker-compose.yml）

# 源码构建
docker compose up -d --build
```

### 预置点播源 + 直播源

在 `compose.yml` 的环境变量中配置：

```yaml
environment:
  - PASSWORD=你的访问密码
  - LIVE_ALLOW_PRIVATE=1   # 允许内网自建 IPTV（组播转单播等）
  - DEFAULT_SOURCES=[...]  # 预置点播源（Apple CMS 采集站）
  - DEFAULT_LIVE_SOURCES=[{"name":"直播源名","url":"https://example.com/list.m3u"}]
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
