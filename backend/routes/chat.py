import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from core.db import db, now_iso
from core.deps import current_workspace, rate_limit
from routes.schemas import ChatIn, ConversationIn, FeedbackIn
from services.chat import answer_stream

router = APIRouter(prefix="/api", tags=["chat"])


async def _conversation(ws: dict, conv_id: str) -> dict:
    conv = await db.conversations.find_one({"id": conv_id, "workspace_id": ws["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv


@router.get("/conversations")
async def list_conversations(ws: dict = Depends(current_workspace)):
    return await db.conversations.find({"workspace_id": ws["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, ws: dict = Depends(current_workspace)):
    conv = await _conversation(ws, conv_id)
    conv["messages"] = await db.messages.find({"conversation_id": conv_id, "workspace_id": ws["id"]}, {"_id": 0}) \
        .sort("created_at", 1).to_list(1000)
    return conv


@router.patch("/conversations/{conv_id}")
async def rename_conversation(conv_id: str, body: ConversationIn, ws: dict = Depends(current_workspace)):
    await _conversation(ws, conv_id)
    await db.conversations.update_one({"id": conv_id}, {"$set": {"title": body.title.strip()}})
    return {"ok": True}


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, ws: dict = Depends(current_workspace)):
    await _conversation(ws, conv_id)
    await db.messages.delete_many({"conversation_id": conv_id, "workspace_id": ws["id"]})
    await db.conversations.delete_one({"id": conv_id, "workspace_id": ws["id"]})
    return {"ok": True}


@router.post("/chat/stream")
async def chat_stream(body: ChatIn, ws: dict = Depends(current_workspace)):
    rate_limit(f"chat:{ws['id']}", 20, 60)
    if body.conversation_id:
        conv = await _conversation(ws, body.conversation_id)
        if body.regenerate:
            last_user = await db.messages.find_one({"conversation_id": conv["id"], "role": "user"}, {"_id": 0},
                                                   sort=[("created_at", -1)])
            if last_user:
                await db.messages.delete_many({"conversation_id": conv["id"], "created_at": {"$gte": last_user["created_at"]}})
            count = await db.messages.count_documents({"conversation_id": conv["id"]})
            await db.conversations.update_one({"id": conv["id"]}, {"$set": {"message_count": count}})
            conv["message_count"] = count
    else:
        conv = {"id": str(uuid.uuid4()), "workspace_id": ws["id"], "title": body.question[:70],
                "message_count": 0, "created_at": now_iso(), "updated_at": now_iso()}
        await db.conversations.insert_one(dict(conv))
        conv.pop("_id", None)
    doc_ids = None
    if body.document_ids:
        owned = await db.documents.find({"workspace_id": ws["id"], "id": {"$in": body.document_ids}}, {"_id": 0, "id": 1}).to_list(None)
        doc_ids = [d["id"] for d in owned] or None
    return StreamingResponse(answer_stream(ws, conv, body.question, doc_ids), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/messages/{msg_id}/feedback")
async def feedback(msg_id: str, body: FeedbackIn, ws: dict = Depends(current_workspace)):
    res = await db.messages.update_one({"id": msg_id, "workspace_id": ws["id"], "role": "assistant"},
                                       {"$set": {"feedback": {"rating": body.rating, "comment": body.comment, "at": now_iso()}}})
    if not res.matched_count:
        raise HTTPException(404, "Message not found")
    return {"ok": True}
