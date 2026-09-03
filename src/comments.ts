// ParaNote-compatible comment endpoints (port of the legacy Django implementation).
import type { Config, Env } from "./config";
import { json, str, toInt, nowIso, clientIp, readParams, sameOriginOk } from "./util";
import { validateId } from "./ids";
import { commentUserId, verifySession, ADMIN_COOKIE, getCookie } from "./auth";
import { timingSafeEqualStr } from "./util";
import * as db from "./db";

const commentsDisabled = () => json({ error: "Comments are disabled" }, 403);
const badReq = (error: string) => json({ error }, 400);
const internal = () => json({ error: "internal_error" }, 500);

export interface CommentCtx {
  cfg: Config;
  env: Env;
  params: Record<string, unknown>;
  request: Request;
}

async function adminOf(c: CommentCtx): Promise<boolean> {
  const session = await verifySession(c.cfg, getCookie(c.request, ADMIN_COOKIE));
  return session !== null;
}

export async function apiComments(c: CommentCtx): Promise<Response> {
  if (!c.cfg.enableComments) return commentsDisabled();
  const method = c.request.method;

  if (method === "GET") {
    const siteId = str(c.params.siteId) || "";
    const workId = str(c.params.workId) || "";
    const chapterId = str(c.params.chapterId) || "";
    if (!siteId || !workId || !chapterId) return badReq("missing_params");
    if (!validateId(siteId) || !validateId(workId) || !validateId(chapterId)) return badReq("invalid_id_format");

    const comments = await db.commentsByWork(c.env.DB, siteId, workId, chapterId);
    const ip = clientIp(c.request);
    let userId: string | null = null;
    if (ip && c.cfg.secret) userId = await commentUserId(ip, siteId, c.cfg.secret);
    let liked = new Set<number>();
    if (userId) {
      liked = await db.likedCommentIdsByUser(
        c.env.DB,
        userId,
        comments.map((x) => x.id),
      );
    }
    const byPara: Record<string, unknown[]> = {};
    for (const cm of comments) {
      const key = String(cm.para_index);
      if (!byPara[key]) byPara[key] = [];
      byPara[key]!.push({
        id: cm.id,
        paraIndex: cm.para_index,
        content: cm.content,
        userName: cm.user_name,
        userId: cm.user_id,
        userAvatar: cm.user_avatar,
        createdAt: cm.created_at,
        likes: cm.likes,
        contextText: cm.context_text,
        isLiked: liked.has(cm.id),
      });
    }
    return json({ commentsByPara: byPara });
  }

  if (method === "POST") {
    try {
      const siteId = str(c.params.siteId) || "";
      const workId = str(c.params.workId) || "";
      const chapterId = str(c.params.chapterId) || "";
      const paraIndex = toInt(c.params.paraIndex);
      const content = str(c.params.content);
      const contextText = str(c.params.contextText);

      if (!siteId || !workId || !chapterId || paraIndex === undefined || !content) return badReq("missing_fields");
      if (!validateId(siteId) || !validateId(workId) || !validateId(chapterId)) return badReq("invalid_id_format");
      if (!Number.isInteger(paraIndex) || paraIndex < 0 || paraIndex > c.cfg.maxParaIndex) return badReq("invalid_para_index");
      if (typeof content !== "string" || content.trim().length === 0) return badReq("empty_content");
      if (content.length > c.cfg.maxCommentLength) return badReq("content_too_long");
      if (contextText && contextText.length > c.cfg.maxContextLength) return badReq("invalid_context_text");

      const trimmedContent = content.trim();
      const trimmedCtx = contextText ? contextText.trim() : null;

      const ip = clientIp(c.request);
      let userId: string | null = null;
      let userName = c.cfg.anonymousName;
      if (ip) {
        const uid = c.cfg.secret ? await commentUserId(ip, siteId, c.cfg.secret) : "ip_" + ip;
        userId = uid;
        userName = c.cfg.commentGuestPrefix + uid.slice(3, 9);
      }
      if (userId) {
        if (await db.isBanned(c.env.DB, siteId, userId)) {
          return json({ error: "user_banned", message: "You are banned from commenting." }, 403);
        }
      }
      // simple rate limit: N comments per minute per IP
      if (ip) {
        const since = new Date(Date.now() - 60_000).toISOString();
        const recent = await db.countCommentsByIpSince(c.env.DB, ip, since);
        if (recent >= c.cfg.maxCommentsPerMinute) return json({ error: "rate_limited" }, 429);
      }

      const comment = await db.createComment(c.env.DB, {
        site_id: siteId,
        work_id: workId,
        chapter_id: chapterId,
        para_index: paraIndex,
        content: trimmedContent,
        user_name: userName,
        user_id: userId,
        user_avatar: null,
        context_text: trimmedCtx,
        ip,
        created_at: nowIso(),
      });
      return json({
        id: comment.id,
        paraIndex: comment.para_index,
        content: comment.content,
        userName: comment.user_name,
        userId: comment.user_id,
        createdAt: comment.created_at,
        likes: comment.likes,
      }, 201);
    } catch (e) {
      return internal();
    }
  }

  if (method === "DELETE") {
    try {
      const commentId = toInt(c.params.commentId);
      const workId = str(c.params.workId);
      const siteId = str(c.params.siteId);
      const chapterId = str(c.params.chapterId);
      if (commentId === undefined) return badReq("missing_fields");
      const comment = await db.commentById(c.env.DB, commentId);
      if (!comment) return json({ error: "not_found" }, 404);
      if (workId && comment.work_id !== workId) return json({ error: "comment_mismatch" }, 400);
      if (siteId && comment.site_id !== siteId) return json({ error: "comment_mismatch" }, 400);
      if (chapterId && comment.chapter_id !== chapterId) return json({ error: "comment_mismatch" }, 400);

      const isAdmin = await adminOf(c);
      const page = workId ? await db.pageByPath(c.env.DB, workId) : null;
      let isAuthor = false;
      if (page) {
        const candidates: (string | undefined)[] = [
          getCookie(c.request, "edit_token_" + page.path) || undefined,
          str(c.params.editToken),
        ];
        for (const cand of candidates) {
          if (cand && (await timingSafeEqualStr(cand, page.edit_token))) {
            isAuthor = true;
            break;
          }
        }
      }
      if (!isAdmin && !isAuthor) return json({ error: "permission_denied" }, 403);
      await db.deleteComment(c.env.DB, commentId);
      return json({ success: true });
    } catch (e) {
      return internal();
    }
  }
  return json({ error: "method not allowed" }, 405);
}

export async function apiLikeComment(c: CommentCtx): Promise<Response> {
  if (!c.cfg.enableComments) return commentsDisabled();
  if (c.request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const commentId = toInt(c.params.commentId);
    const siteId = str(c.params.siteId) || "";
    if (commentId === undefined || !siteId) return badReq("missing_fields");
    if (!validateId(siteId)) return badReq("invalid_id_format");
    const comment = await db.commentById(c.env.DB, commentId);
    if (!comment) return json({ error: "not_found" }, 404);
    if (comment.site_id !== siteId) return json({ error: "comment_mismatch" }, 400);

    const ip = clientIp(c.request);
    if (!ip) return badReq("cannot_identify_user");
    if (ip) {
      const since = new Date(Date.now() - 60_000).toISOString();
      const recent = await db.countLikesByIpSince(c.env.DB, ip, since);
      if (recent >= c.cfg.maxLikesPerMinute) return json({ error: "rate_limited" }, 429);
    }
    const uid = c.cfg.secret ? await commentUserId(ip, siteId, c.cfg.secret) : "ip_" + ip;
    const res = await db.addLike(c.env.DB, comment.id, uid, ip, nowIso());
    const likes = await db.recountLikes(c.env.DB, comment.id);
    if (res === "exists") return json({ error: "already_liked", likes }, 400);
    return json({ likes });
  } catch (e) {
    return internal();
  }
}

export async function apiBan(c: CommentCtx): Promise<Response> {
  if (!c.cfg.enableComments) return commentsDisabled();
  const method = c.request.method;
  if (method !== "GET" && !sameOriginOk(c.request, new URL(c.request.url))) {
    return json({ error: "origin_mismatch" }, 403);
  }
  const isAdmin = await adminOf(c);
  if (!isAdmin) return json({ error: "permission_denied", message: "Admins only" }, 403);

  const siteId = (str(c.params.siteId) || "").trim();
  if (!siteId) return badReq("missing_params");
  if (!validateId(siteId)) return badReq("invalid_id_format");

  if (method === "GET") {
    const bans = await db.bansBySite(c.env.DB, siteId);
    return json({
      bannedUsers: bans.map((b) => ({
        userId: b.user_id,
        reason: b.reason,
        bannedBy: b.banned_by,
        bannedAt: b.created_at,
      })),
    });
  }

  if (method === "POST") {
    const targetUserId = str(c.params.targetUserId) || "";
    const reason = str(c.params.reason) || "";
    if (!targetUserId) return badReq("missing_fields");
    await db.addBan(c.env.DB, siteId, targetUserId, reason || null, "admin", nowIso());
    return json({ success: true });
  }

  if (method === "DELETE") {
    const targetUserId = str(c.params.targetUserId) || "";
    if (!targetUserId) return badReq("missing_fields");
    const removed = await db.removeBan(c.env.DB, siteId, targetUserId);
    if (!removed) return json({ error: "not_found" }, 404);
    return json({ success: true });
  }
  return json({ error: "method_not_allowed" }, 405);
}

export async function routeCommentApi(
  cfg: Config,
  env: Env,
  request: Request,
  url: URL,
  action: "comments" | "like" | "ban",
): Promise<Response> {
  const params = await readParams(request);
  // GET params from query string as fallback (Django read request.GET for GET/DELETE-ish flows)
  if (request.method === "GET" && Object.keys(params).length === 0) {
    for (const [k, v] of url.searchParams) params[k] = v;
  }
  const ctx: CommentCtx = { cfg, env, params, request };
  if (action === "comments") return apiComments(ctx);
  if (action === "like") return apiLikeComment(ctx);
  return apiBan(ctx);
}
