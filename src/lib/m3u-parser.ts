import type { LiveChannel } from './types';

/**
 * M3U / M3U8 直播播放列表解析。
 *
 * 兼容两种常见写法：
 * - 标准：`#EXTINF:-1 tvg-id="cctv1" tvg-logo="..." group-title="央视",CCTV-1`
 * - 非标准（属性写在标题后）：`#EXTINF:-1,CCTV-1 tvg-id="cctv1"`
 * 另支持 `#EXTGRP:分组名` 补充分组（属性缺失时的常见替代写法）。
 *
 * 解析为单趟扫描（O(n)），频道按 URL 去重，仅保留 http(s) 流地址
 * （rtp:// udp:// rtsp:// 等浏览器无法播放的协议直接丢弃）。
 */

const ATTR_RE = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
const ATTR_STRIP_RE = /[a-zA-Z0-9_-]+="[^"]*"/g;

/** 由任意字符串生成稳定的短 id（djb2 变体，与 store.ts subKeyPrefix 同风格） */
function stableId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** 相对地址按订阅 URL 解析为绝对地址；仅放行 http(s) */
export function normalizeStreamUrl(raw: string, baseUrl?: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return undefined;
    return resolved.href;
  } catch {
    return undefined;
  }
}

/** URL 无名时的兜底名称：取路径末段，decode 后仍空则用主机名 */
function nameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last) {
      const decoded = decodeURIComponent(last).replace(/\.(m3u8?|flv|ts|mp4)$/i, '');
      if (decoded) return decoded;
    }
    return u.hostname;
  } catch {
    return '未命名频道';
  }
}

interface ExtinfContext {
  attrs: Record<string, string>;
  title: string;
  /** #EXTGRP 补充的分组（EXTINF 自身带 group-title 时忽略） */
  extGroup: string;
}

export function parseM3u(content: string, baseUrl?: string): LiveChannel[] {
  const channels: LiveChannel[] = [];
  if (!content) return channels;

  const seen = new Set<string>();
  let ctx: ExtinfContext | null = null;
  // txt 频道列表（TVBox 风格）的当前分组：由 #genre# / #group# 等分隔行决定
  let txtGroup = '';

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toUpperCase().startsWith('#EXTINF')) {
      const attrs: Record<string, string> = {};
      ATTR_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = ATTR_RE.exec(line))) attrs[m[1].toLowerCase()] = m[2].trim();

      // 移除属性片段后取首个逗号之后的文本为显示名
      const stripped = line.replace(ATTR_STRIP_RE, '').replace(/^#EXTINF\s*:\s*/i, '');
      const commaIdx = stripped.indexOf(',');
      const title = (commaIdx >= 0 ? stripped.slice(commaIdx + 1) : stripped)
        .trim()
        .replace(/^"+|"+$/g, '');

      ctx = { attrs, title, extGroup: '' };
      continue;
    }

    if (line.toUpperCase().startsWith('#EXTGRP:')) {
      const g = line.slice('#EXTGRP:'.length).trim();
      if (ctx && g && !ctx.attrs['group-title']) ctx.extGroup = g;
      continue;
    }

    if (line.startsWith('#')) {
      // txt 分组行：#genre# / #group# / #分类# 等，识别为分组标题
      const gm = line.match(/^#\s*(?:genre|group|分类|category)\s*[#:：]?\s*(.*)$/i);
      if (gm && gm[1] && gm[1].trim()) {
        txtGroup = gm[1].trim().replace(/#$/, '').trim();
      }
      continue; // 其余指令（#EXTVLCOPT 等）忽略
    }

    // 非注释行：可能是流地址，也可能是 txt 的 "名称,URL" 逗号格式
    let nameFromTxt: string | undefined;
    let urlCandidate = line;

    // txt 分组行（分组名放在逗号前，逗号后是 #genre# / #group# 等标记）：
    // 例如 "央视,#genre#" 或 "卫视,#group#"
    const commaIdx = line.indexOf(',');
    if (commaIdx > 0) {
      const leftPart = line.slice(0, commaIdx).trim();
      const rightPart = line.slice(commaIdx + 1).trim();

      // 逗号后是分组标记 → 更新分组，跳过该行
      if (/^#?(?:genre|group|分类|category)[#:]?$/i.test(rightPart)) {
        if (leftPart) txtGroup = leftPart;
        continue;
      }

      // 逗号后是绝对 http(s) 地址 → txt 的 "名称,URL" 格式
      if (/^https?:\/\//i.test(rightPart)) {
        nameFromTxt = leftPart || undefined;
        urlCandidate = rightPart;
      }
    }

    const url = normalizeStreamUrl(urlCandidate, baseUrl);
    const cur = ctx;
    ctx = null;
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const attrs = cur?.attrs ?? {};
    const tvgId = attrs['tvg-id'] || undefined;
    const logo = attrs['tvg-logo'] ? normalizeStreamUrl(attrs['tvg-logo'], baseUrl) : undefined;
    const name = cur?.title || nameFromTxt || nameFromUrl(url);
    channels.push({
      id: tvgId || stableId(url),
      name,
      url,
      logo,
      group: attrs['group-title'] || cur?.extGroup || txtGroup || undefined,
      tvgId,
      rawName: attrs['tvg-name'] || undefined,
    });
  }

  return channels;
}
