import json
import re
import uuid
from openai import AsyncOpenAI

from core.config import ALLOWED_MODELS, LLM_MODEL, openai_key


class UsageStats:
    def __init__(self, input_tokens=0, output_tokens=0):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens


async def stream_llm(system: str, prompt: str, model: str | None = None):
    """Yields ("delta", text) events then one ("done", usage)."""
    key = openai_key()
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not configured on the server.")

    client = AsyncOpenAI(api_key=key, timeout=60, max_retries=3)
    target_model = model if model in ALLOWED_MODELS else LLM_MODEL

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]

    response = await client.chat.completions.create(
        model=target_model,
        messages=messages,
        stream=True,
        stream_options={"include_usage": True},
    )

    usage_obj = UsageStats(0, 0)
    async for chunk in response:
        if chunk.choices and len(chunk.choices) > 0:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield "delta", delta.content
        if chunk.usage:
            usage_obj = UsageStats(
                input_tokens=getattr(chunk.usage, "prompt_tokens", 0) or 0,
                output_tokens=getattr(chunk.usage, "completion_tokens", 0) or 0,
            )

    yield "done", usage_obj


async def complete(system: str, prompt: str, model: str | None = None) -> tuple[str, dict]:
    parts, usage = [], None
    async for kind, value in stream_llm(system, prompt, model):
        if kind == "delta":
            parts.append(value)
        else:
            usage = value
    tokens = {
        "input_tokens": getattr(usage, "input_tokens", 0) or 0,
        "output_tokens": getattr(usage, "output_tokens", 0) or 0,
    }
    return "".join(parts), tokens


def parse_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Model did not return JSON")
    return json.loads(text[start:end + 1])


async def complete_json(system: str, prompt: str, model: str | None = None) -> tuple[dict, dict]:
    text, tokens = await complete(
        system + "\nRespond with a single valid JSON object only, no prose, no code fences.",
        prompt,
        model,
    )
    return parse_json(text), tokens
