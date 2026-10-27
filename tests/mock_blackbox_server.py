"""
Mock "Black Box" MCP Server for Testing & Practice Arena.
Implements the JSON-RPC 2.0 stdio MCP protocol, providing hidden tools,
text decryption challenges, and image metadata analysis.
"""

import base64
import json
import sys


def handle_request(req: dict) -> dict:
    req_id = req.get("id")
    method = req.get("method")
    params = req.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {"listChanged": False},
                },
                "serverInfo": {
                    "name": "NVIDIA-Gauntlet-BlackBox-PracticeArena",
                    "version": "1.0.0",
                },
            },
        }

    elif method == "notifications/initialized":
        return None

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": [
                    {
                        "name": "list_challenges",
                        "description": "Lists current active challenges and encrypted puzzles waiting for resolution.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {},
                        },
                    },
                    {
                        "name": "decode_cipher",
                        "description": "Decodes rot13 or base64 encrypted payloads discovered in challenges.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "input_data": {"type": "string", "description": "The encoded ciphertext"},
                            },
                            "required": ["input_data"],
                        },
                    },
                    {
                        "name": "analyze_image_chunk",
                        "description": "Performs multimodal inspection on challenge images to uncover hidden keys.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "target": {"type": "string", "description": "Image identifier or chunk index"},
                            },
                            "required": ["target"],
                        },
                    },
                    {
                        "name": "submit_challenge_answer",
                        "description": "Submits final verified solution for a challenge to receive score validation.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "task_id": {"type": "string"},
                                "solution": {"type": "string"},
                            },
                            "required": ["task_id", "solution"],
                        },
                    },
                ],
            },
        }

    elif method == "tools/call":
        name = params.get("name")
        args = params.get("arguments", {})

        if name == "list_challenges":
            # Encrypted text in base64: "DAKTARI_SDG3_HEALTH_KEY_2026"
            encoded_key = base64.b64encode(b"DAKTARI_SDG3_HEALTH_KEY_2026").decode("utf-8")
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps({
                                "active_challenge": "challenge_1",
                                "domain": "text_and_image",
                                "prompt": "Extract and decode the hidden payload from the server.",
                                "ciphertext_payload": encoded_key,
                            }),
                        }
                    ],
                    "isError": False,
                },
            }

        elif name == "decode_cipher":
            data = args.get("input_data", "")
            # Try to extract base64 or rot13
            try:
                # If JSON string was passed, parse it
                if "{" in data:
                    parsed = json.loads(data)
                    data = parsed.get("ciphertext_payload", data)
                decoded = base64.b64decode(data.strip()).decode("utf-8")
                output_text = f"Decoded result: {decoded}"
            except Exception:
                output_text = f"Decoded result: {data}"

            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": output_text}],
                    "isError": False,
                },
            }

        elif name == "analyze_image_chunk":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": "Visual inspection verified: no anomaly markers found."}],
                    "isError": False,
                },
            }

        elif name == "submit_challenge_answer":
            sol = args.get("solution", "")
            if "DAKTARI_SDG3_HEALTH_KEY_2026" in sol or "Decoded result" in sol:
                verdict = "CHALLENGE_SOLVED: 100/100 points. All tests passed."
                is_err = False
            else:
                verdict = "CHALLENGE_FAILED: Incorrect solution."
                is_err = True

            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": verdict}],
                    "isError": is_err,
                },
            }

        else:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {
                    "code": -32601,
                    "message": f"Method/Tool '{name}' not found",
                },
            }

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {"code": -32601, "message": f"Unhandled method '{method}'"},
    }


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            res = handle_request(req)
            if res is not None:
                sys.stdout.write(json.dumps(res) + "\n")
                sys.stdout.flush()
        except Exception as e:
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"Parse error: {e}"},
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
