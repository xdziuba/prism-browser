#!/usr/bin/env python3
"""Make one minimal, non-stored OpenAI Responses API feasibility request."""

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main() -> int:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        print("OPENAI_API_KEY is missing; API probe not run.", file=sys.stderr)
        return 2
    model = os.environ.get("PRISM_OPENAI_MODEL", "gpt-5-mini")
    body = json.dumps({
        "model": model,
        "input": "Reply with exactly PRISM_OK.",
        "max_output_tokens": 32,
        "store": False,
    }).encode("utf-8")
    request = Request(
        "https://api.openai.com/v1/responses",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            data = json.load(response)
    except HTTPError as error:
        print(f"OpenAI API HTTP {error.code}; response body omitted.", file=sys.stderr)
        return 1
    except URLError as error:
        print(f"OpenAI API connection failed: {error.reason}", file=sys.stderr)
        return 1

    status = data.get("status")
    print(f"model={data.get('model')} status={status} response_id={data.get('id')}")
    return 0 if status == "completed" and data.get("object") == "response" else 1


if __name__ == "__main__":
    raise SystemExit(main())
