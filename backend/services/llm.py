import json
import re
import uuid

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

from core.config import ALLOWED_MODELS, LLM_MODEL, emergent_key


def _chat(system: str, model: str | None) -> LlmChat:
    model = model if model in ALLOWED_MODELS else LLM_MODEL
    return LlmChat(api_key=emergent_key(), session_id=str(uuid.uuid4()), system_message=system).with_model("openai", model)


async def stream_llm(system: str, prompt: str, model: str | None = None):
    """Yields ("delta", text) events then one ("done", usage)."""
    async for ev in _chat(system, model).stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            yield "delta", ev.content
        elif isinstance(ev, StreamDone):
            yield "done", ev.usage
            break


async def complete(system: str, prompt: str, model: str | None = None) -> tuple[str, dict]:
    parts, usage = [], None
    async for kind, value in stream_llm(system, prompt, model):
        if kind == "delta":
            parts.append(value)
        else:
            usage = value
    tokens = {"input_tokens": getattr(usage, "input_tokens", 0) or 0,
              "output_tokens": getattr(usage, "output_tokens", 0) or 0}
    return "".join(parts), tokens


def parse_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Model did not return JSON")
    return json.loads(text[start:end + 1])


async def complete_json(system: str, prompt: str, model: str | None = None) -> tuple[dict, dict]:
    text, tokens = await complete(system + "\nRespond with a single valid JSON object only, no prose, no code fences.", prompt, model)
    return parse_json(text), tokens
