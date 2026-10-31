import { NextResponse } from 'next/server';
import { guardRequest, jsonError } from '@/lib/api-guard';
import { checkLiveUrlAllowed } from '@/lib/ssrf';
import { fetchUpstreamWithMeta } from '@/lib/fetch-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 直播流格式探测：GET /api/live/detect?url=<encoded>
 *
 * 只拉取响应头（不下载 body），返回上游流的 Content-Type 与重定向后最终地址。
 * 用于无后缀直播源（如 http://host/数字ID 这种 302→m3u8 或裸 TS 中转）在播放前
 * 快速判断该走 hls 还是 mpegts，避免"猜错引擎→失败→回退"的漫长等待。
 *
 * 前端跨域 HEAD 请求会被 CORS 拦截，因此探测必须在服务端完成（同源无 CORS 问题）。
 */
export async function GET(req: Request) {
  const guarded = guardRequest(req);
  if (guarded) return guarded;

  const sp = new URL(req.url).searchParams;
  const url = sp.get('url')?.trim();
  if (!url) return jsonError('缺少 url 参数', 400);

  // 直播专用 SSRF 校验（与直播流代理同一把尺子）
  const verdict = await checkLiveUrlAllowed(url);
  if (!verdict.ok) return jsonError(verdict.reason, 403);

  try {
    // 只等响应头，拿到后立即返回；body 不下载（TS 流是无限长连接）
    const { res, finalUrl } = await fetchUpstreamWithMeta(url, {
      timeoutMs: 8000,
      retries: 0,
      allowPrivate: true,
    });

    // 立即关闭 body，避免占用连接/下载无限流
    try { await res.body?.cancel(); } catch { /* 忽略 */ }

    const contentType = res.headers.get('content-type') || '';
    return NextResponse.json(
      {
        status: res.status,
        contentType,
        finalUrl,
        ok: res.ok,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return jsonError(
      `探测失败: ${err instanceof Error ? err.message : '未知错误'}`,
      502
    );
  }
}
