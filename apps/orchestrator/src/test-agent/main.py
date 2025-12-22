#!/usr/bin/env python3
"""
Test Agent for E2E Integration Tests

A self-contained FastAPI agent that mimics pixell-sdk behavior for testing
the workflow protocol system. This agent implements the A2A protocol and
supports configurable test scenarios.

Environment Variables:
  - TEST_AGENT_PORT: Port to run the agent on (default: 9999)
  - TEST_SCENARIO: Which test scenario to run (default: full_plan_mode)
  - TEST_AGENT_DELAY_MS: Delay between events in ms (default: 50)

Usage:
  python main.py

Test Scenarios:
  - full_plan_mode: Complete workflow through all phases
  - direct_execution: Skip plan mode, execute directly
  - error_mid_execution: Simulate error during execution
  - multi_clarification: Multiple rounds of clarification
  - timeout_scenario: Agent never responds (for timeout testing)
"""

import asyncio
import json
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, List, Optional, Literal
from dataclasses import dataclass, field

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
import uvicorn


# =============================================================================
# Configuration
# =============================================================================

TEST_AGENT_PORT = int(os.environ.get("TEST_AGENT_PORT", "9999"))
TEST_SCENARIO = os.environ.get("TEST_SCENARIO", "full_plan_mode")
TEST_AGENT_DELAY_MS = int(os.environ.get("TEST_AGENT_DELAY_MS", "50"))
AGENT_ID = "test-workflow-agent"


# =============================================================================
# SSE Event Helpers
# =============================================================================

def sse_event(event_type: str, data: Dict[str, Any]) -> str:
    """Format an SSE event with proper line endings."""
    event_id = str(uuid.uuid4())[:8]
    return f"id: {event_id}\nevent: {event_type}\ndata: {json.dumps(data)}\n\n"


def json_rpc_response(request_id: str, result: Dict[str, Any]) -> str:
    """Format a JSON-RPC streaming response."""
    return f"data: {json.dumps({'jsonrpc': '2.0', 'id': request_id, 'result': result})}\n\n"


async def delay():
    """Add configured delay between events."""
    await asyncio.sleep(TEST_AGENT_DELAY_MS / 1000.0)


# =============================================================================
# Session State Management (in-memory for tests)
# =============================================================================

@dataclass
class SessionState:
    """Track state for a single session."""
    session_id: str
    workflow_id: str
    current_phase: str = "initial"
    clarification_responses: Dict[str, Any] = field(default_factory=dict)
    selection_responses: Dict[str, List[str]] = field(default_factory=dict)
    preview_responses: Dict[str, bool] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)


# In-memory session store for test scenarios
sessions: Dict[str, SessionState] = {}


def get_or_create_session(session_id: str, workflow_id: str) -> SessionState:
    """Get existing session or create new one."""
    if session_id not in sessions:
        sessions[session_id] = SessionState(
            session_id=session_id,
            workflow_id=workflow_id
        )
    return sessions[session_id]


# =============================================================================
# Test Scenario Implementations
# =============================================================================

async def run_full_plan_mode(
    request_id: str,
    session_id: str,
    workflow_id: str,
    message: str
) -> AsyncGenerator[str, None]:
    """
    Full workflow: initial -> clarification -> discovery -> selection -> preview -> completed

    This tests the complete plan mode flow with all phase transitions.
    """
    session = get_or_create_session(session_id, workflow_id)

    # Phase 1: Working state (thinking indicator)
    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "working",
            "message": {
                "role": "assistant",
                "parts": [{"text": "Analyzing your request..."}],
                "metadata": {"event_type": "analyzing"}
            }
        }
    })
    await delay()

    # Phase 2: Clarification needed - Agent needs more info
    clarification_id = str(uuid.uuid4())
    session.current_phase = "clarification"

    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "input-required",
            "message": {
                "role": "assistant",
                "parts": [{
                    "data": {
                        "type": "clarification_needed",
                        "workflowId": workflow_id,
                        "clarificationId": clarification_id,
                        "questions": [
                            {
                                "questionId": "topic",
                                "questionType": "single_choice",
                                "question": "What topic are you interested in?",
                                "header": "Topic",
                                "options": [
                                    {"id": "tech", "label": "Technology", "description": "Tech news and discussions"},
                                    {"id": "science", "label": "Science", "description": "Scientific discoveries"},
                                    {"id": "gaming", "label": "Gaming", "description": "Video games and esports"}
                                ]
                            },
                            {
                                "questionId": "depth",
                                "questionType": "single_choice",
                                "question": "How deep should the analysis be?",
                                "header": "Depth",
                                "options": [
                                    {"id": "quick", "label": "Quick scan", "description": "Surface-level analysis"},
                                    {"id": "detailed", "label": "Detailed", "description": "In-depth analysis"}
                                ]
                            }
                        ],
                        "message": "I need a bit more information to proceed.",
                        "timeoutMs": 300000
                    }
                }]
            }
        }
    })
    await delay()


async def run_full_plan_mode_continued(
    request_id: str,
    session_id: str,
    workflow_id: str,
    answers: Dict[str, Any]
) -> AsyncGenerator[str, None]:
    """
    Continue full_plan_mode after clarification response.
    Goes through discovery -> selection -> preview -> completed.
    """
    session = get_or_create_session(session_id, workflow_id)
    session.clarification_responses.update(answers)

    # Extract user's topic choice
    topic = answers.get("topic", "tech")

    # Phase 3: Working - Discovery in progress
    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "working",
            "message": {
                "role": "assistant",
                "parts": [{"text": f"Discovering {topic}-related subreddits..."}],
                "metadata": {"event_type": "discovering"}
            }
        }
    })
    await delay()

    # Phase 4: Discovery result
    discovery_id = str(uuid.uuid4())
    session.current_phase = "discovery"

    discovered_items = [
        {"id": "sub-1", "name": f"r/{topic}", "description": f"Main {topic} subreddit", "memberCount": 15000000},
        {"id": "sub-2", "name": f"r/{topic}news", "description": f"Latest {topic} news", "memberCount": 2500000},
        {"id": "sub-3", "name": f"r/ask{topic}", "description": f"Questions about {topic}", "memberCount": 1800000},
    ]

    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "input-required",
            "message": {
                "role": "assistant",
                "parts": [{
                    "data": {
                        "type": "discovery_result",
                        "workflowId": workflow_id,
                        "discoveryId": discovery_id,
                        "discoveryType": "subreddits",
                        "items": discovered_items,
                        "message": f"I found {len(discovered_items)} subreddits related to {topic}."
                    }
                }]
            }
        }
    })
    await delay()

    # Phase 5: Selection required
    selection_id = str(uuid.uuid4())
    session.current_phase = "selection"

    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "input-required",
            "message": {
                "role": "assistant",
                "parts": [{
                    "data": {
                        "type": "selection_required",
                        "workflowId": workflow_id,
                        "selectionId": selection_id,
                        "items": discovered_items,
                        "minSelect": 1,
                        "maxSelect": 3,
                        "message": "Please select which subreddits to analyze."
                    }
                }]
            }
        }
    })
    await delay()


async def run_selection_to_completion(
    request_id: str,
    session_id: str,
    workflow_id: str,
    selected_ids: List[str]
) -> AsyncGenerator[str, None]:
    """
    Continue from selection -> preview -> completed.
    """
    session = get_or_create_session(session_id, workflow_id)

    # Phase 6: Preview ready
    plan_id = str(uuid.uuid4())
    session.current_phase = "preview"

    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "input-required",
            "message": {
                "role": "assistant",
                "parts": [{
                    "data": {
                        "type": "preview_ready",
                        "workflowId": workflow_id,
                        "planId": plan_id,
                        "title": "Analysis Plan",
                        "summary": f"I will analyze {len(selected_ids)} subreddits for trending topics and sentiment.",
                        "steps": [
                            {"id": "step-1", "description": "Fetch recent posts", "status": "pending"},
                            {"id": "step-2", "description": "Analyze sentiment", "status": "pending"},
                            {"id": "step-3", "description": "Generate report", "status": "pending"}
                        ],
                        "searchKeywords": ["trending", "popular", "discussion"],
                        "hashtags": ["#analysis", "#reddit"],
                        "requiresApproval": True,
                        "message": "Here's my analysis plan. Ready to proceed?"
                    }
                }]
            }
        }
    })
    await delay()


async def run_preview_to_completion(
    request_id: str,
    session_id: str,
    workflow_id: str,
    approved: bool
) -> AsyncGenerator[str, None]:
    """
    Complete the workflow after preview approval.
    """
    session = get_or_create_session(session_id, workflow_id)

    if not approved:
        # User rejected - complete with rejection message
        session.current_phase = "completed"
        yield json_rpc_response(request_id, {
            "kind": "message",
            "sessionId": session_id,
            "parts": [{"text": "Analysis cancelled. Let me know if you'd like to try something different."}]
        })
        return

    # Phase 7: Executing
    session.current_phase = "executing"

    for i, step in enumerate(["Fetching posts...", "Analyzing sentiment...", "Generating report..."]):
        yield json_rpc_response(request_id, {
            "kind": "status-update",
            "sessionId": session_id,
            "status": {
                "state": "working",
                "message": {
                    "role": "assistant",
                    "parts": [{"text": step}],
                    "metadata": {"event_type": "executing", "step": i + 1, "total": 3}
                }
            }
        })
        await delay()

    # Phase 8: File created (output)
    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "working",
            "message": {
                "role": "assistant",
                "parts": [{
                    "data": {
                        "type": "file_created",
                        "path": "/reports/analysis-report.html",
                        "name": "analysis-report.html",
                        "format": "html",
                        "size": 45678,
                        "summary": "Comprehensive analysis report with sentiment breakdown"
                    }
                }]
            }
        }
    })
    await delay()

    # Phase 9: Completed
    session.current_phase = "completed"

    yield json_rpc_response(request_id, {
        "kind": "message",
        "sessionId": session_id,
        "parts": [{
            "text": "Analysis complete! I analyzed the selected subreddits and found:\n\n"
                    "- **Overall Sentiment**: 67% positive\n"
                    "- **Trending Topics**: AI, Climate, Gaming\n"
                    "- **Peak Activity**: Weekday evenings\n\n"
                    "The detailed report has been saved."
        }]
    })


async def run_direct_execution(
    request_id: str,
    session_id: str,
    workflow_id: str,
    message: str
) -> AsyncGenerator[str, None]:
    """
    Direct execution without plan mode - goes straight to completion.
    Tests the simple path without clarification/selection phases.
    """
    session = get_or_create_session(session_id, workflow_id)

    # Simple working state
    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "working",
            "message": {
                "role": "assistant",
                "parts": [{"text": "Processing your request..."}],
                "metadata": {"event_type": "processing"}
            }
        }
    })
    await delay()

    # Complete immediately
    session.current_phase = "completed"

    yield json_rpc_response(request_id, {
        "kind": "message",
        "sessionId": session_id,
        "parts": [{
            "text": f"I received your message: '{message}'\n\nThis is a direct execution response without plan mode."
        }]
    })


async def run_error_mid_execution(
    request_id: str,
    session_id: str,
    workflow_id: str,
    message: str
) -> AsyncGenerator[str, None]:
    """
    Simulates an error occurring during execution phase.
    Tests error handling and recovery.
    """
    session = get_or_create_session(session_id, workflow_id)

    # Start working
    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "working",
            "message": {
                "role": "assistant",
                "parts": [{"text": "Starting execution..."}],
                "metadata": {"event_type": "executing"}
            }
        }
    })
    await delay()

    # Simulate progress
    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "working",
            "message": {
                "role": "assistant",
                "parts": [{"text": "Processing step 1 of 3..."}],
                "metadata": {"event_type": "executing", "step": 1, "total": 3}
            }
        }
    })
    await delay()

    # Error occurs
    session.current_phase = "error"

    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "failed",
            "message": {
                "role": "assistant",
                "parts": [{
                    "text": "Error: Connection to external API timed out after 30 seconds"
                }]
            }
        }
    })


async def run_multi_clarification(
    request_id: str,
    session_id: str,
    workflow_id: str,
    message: str
) -> AsyncGenerator[str, None]:
    """
    Multiple rounds of clarification - tests clarification->clarification transition.
    """
    session = get_or_create_session(session_id, workflow_id)

    # First clarification
    clarification_id_1 = str(uuid.uuid4())
    session.current_phase = "clarification"

    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "input-required",
            "message": {
                "role": "assistant",
                "parts": [{
                    "data": {
                        "type": "clarification_needed",
                        "workflowId": workflow_id,
                        "clarificationId": clarification_id_1,
                        "questions": [{
                            "questionId": "category",
                            "questionType": "single_choice",
                            "question": "What category are you interested in?",
                            "header": "Category",
                            "options": [
                                {"id": "news", "label": "News", "description": "Current events"},
                                {"id": "entertainment", "label": "Entertainment", "description": "Movies, TV, etc."}
                            ]
                        }],
                        "message": "First, let me understand your category preference."
                    }
                }]
            }
        }
    })


async def run_multi_clarification_round2(
    request_id: str,
    session_id: str,
    workflow_id: str,
    answers: Dict[str, Any]
) -> AsyncGenerator[str, None]:
    """
    Second clarification round after first answer.
    """
    session = get_or_create_session(session_id, workflow_id)
    session.clarification_responses.update(answers)

    # Acknowledge first answer
    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "working",
            "message": {
                "role": "assistant",
                "parts": [{"text": "Great! I have one more question..."}]
            }
        }
    })
    await delay()

    # Second clarification
    clarification_id_2 = str(uuid.uuid4())

    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "input-required",
            "message": {
                "role": "assistant",
                "parts": [{
                    "data": {
                        "type": "clarification_needed",
                        "workflowId": workflow_id,
                        "clarificationId": clarification_id_2,
                        "questions": [{
                            "questionId": "timeframe",
                            "questionType": "single_choice",
                            "question": "What timeframe should I analyze?",
                            "header": "Timeframe",
                            "options": [
                                {"id": "day", "label": "Last 24 hours", "description": "Recent content"},
                                {"id": "week", "label": "Last week", "description": "Weekly trends"},
                                {"id": "month", "label": "Last month", "description": "Monthly overview"}
                            ]
                        }],
                        "message": "One more detail - what timeframe?"
                    }
                }]
            }
        }
    })


async def run_timeout_scenario(
    request_id: str,
    session_id: str,
    workflow_id: str,
    message: str
) -> AsyncGenerator[str, None]:
    """
    Never responds - for testing timeout handling.
    """
    session = get_or_create_session(session_id, workflow_id)

    # Send initial working state
    yield json_rpc_response(request_id, {
        "kind": "status-update",
        "sessionId": session_id,
        "status": {
            "state": "working",
            "message": {
                "role": "assistant",
                "parts": [{"text": "Starting long operation..."}]
            }
        }
    })

    # Sleep forever (or until client times out)
    await asyncio.sleep(600)  # 10 minutes - client should timeout first


# =============================================================================
# FastAPI Application
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print(f"Test Agent starting on port {TEST_AGENT_PORT}")
    print(f"Scenario: {TEST_SCENARIO}")
    print(f"Event delay: {TEST_AGENT_DELAY_MS}ms")
    yield
    print("Test Agent shutting down")


app = FastAPI(
    title="Test Workflow Agent",
    description="E2E test agent for workflow protocol testing",
    lifespan=lifespan
)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "agent_id": AGENT_ID, "scenario": TEST_SCENARIO}


@app.post("/")
async def handle_message(request: Request):
    """
    Main A2A message handler.

    Expects JSON-RPC format:
    {
        "jsonrpc": "2.0",
        "method": "message/stream",
        "id": "<request_id>",
        "params": {
            "sessionId": "<session_id>",
            "workflowId": "<workflow_id>",
            "message": { ... }
        }
    }
    """
    body = await request.json()

    method = body.get("method", "")
    request_id = body.get("id", str(uuid.uuid4()))
    params = body.get("params", {})

    session_id = params.get("sessionId", str(uuid.uuid4()))
    workflow_id = params.get("workflowId", str(uuid.uuid4()))
    message_obj = params.get("message", {})

    # Extract text from message parts
    text_parts = message_obj.get("parts", [])
    message_text = ""
    for part in text_parts:
        if isinstance(part, dict) and "text" in part:
            message_text = part["text"]
            break

    # Check for plan mode flag
    metadata = message_obj.get("metadata", {})
    plan_mode = metadata.get("plan_mode_enabled", False) or params.get("metadata", {}).get("planMode", False)

    print(f"Received message: method={method}, session={session_id}, workflow={workflow_id}")
    print(f"Plan mode: {plan_mode}, Scenario: {TEST_SCENARIO}")

    async def generate():
        """Generate SSE events based on scenario."""
        scenario = TEST_SCENARIO

        # Check specific test scenarios first (regardless of plan_mode)
        if scenario == "error_mid_execution":
            async for event in run_error_mid_execution(request_id, session_id, workflow_id, message_text):
                yield event
        elif scenario == "timeout_scenario":
            async for event in run_timeout_scenario(request_id, session_id, workflow_id, message_text):
                yield event
        elif scenario == "multi_clarification":
            async for event in run_multi_clarification(request_id, session_id, workflow_id, message_text):
                yield event
        elif scenario == "full_plan_mode" and plan_mode:
            async for event in run_full_plan_mode(request_id, session_id, workflow_id, message_text):
                yield event
        elif scenario == "direct_execution" or not plan_mode:
            async for event in run_direct_execution(request_id, session_id, workflow_id, message_text):
                yield event
        else:
            # Default to direct execution
            async for event in run_direct_execution(request_id, session_id, workflow_id, message_text):
                yield event

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/a2a/respond")
async def handle_respond(request: Request):
    """
    Handle clarification/selection/preview responses.

    Request body:
    {
        "sessionId": "<session_id>",
        "clarificationId": "<id>",
        "answers": { "questionId": "value" },
        // OR
        "selectionId": "<id>",
        "selectedIds": ["id1", "id2"],
        // OR
        "planId": "<id>",
        "approved": true
    }
    """
    body = await request.json()

    session_id = body.get("sessionId", "")
    workflow_id = ""

    # Get session and workflow_id
    if session_id in sessions:
        workflow_id = sessions[session_id].workflow_id
    else:
        workflow_id = str(uuid.uuid4())

    request_id = str(uuid.uuid4())

    # Determine response type
    clarification_id = body.get("clarificationId")
    selection_id = body.get("selectionId")
    plan_id = body.get("planId")

    print(f"Received respond: session={session_id}, clarification={clarification_id}, selection={selection_id}, plan={plan_id}")

    async def generate():
        """Generate response based on what type of input was received."""
        scenario = TEST_SCENARIO

        if clarification_id and "answers" in body:
            answers = body["answers"]

            if scenario == "multi_clarification":
                # Check if this is first or second clarification
                session = get_or_create_session(session_id, workflow_id)
                if len(session.clarification_responses) == 0:
                    async for event in run_multi_clarification_round2(request_id, session_id, workflow_id, answers):
                        yield event
                else:
                    # After second clarification, complete
                    async for event in run_direct_execution(request_id, session_id, workflow_id, "Final response"):
                        yield event
            else:
                # Continue full_plan_mode flow
                async for event in run_full_plan_mode_continued(request_id, session_id, workflow_id, answers):
                    yield event

        elif selection_id and "selectedIds" in body:
            selected_ids = body["selectedIds"]
            async for event in run_selection_to_completion(request_id, session_id, workflow_id, selected_ids):
                yield event

        elif plan_id and "approved" in body:
            approved = body["approved"]
            async for event in run_preview_to_completion(request_id, session_id, workflow_id, approved):
                yield event

        else:
            # Unknown response type
            yield json_rpc_response(request_id, {
                "kind": "status-update",
                "sessionId": session_id,
                "status": {
                    "state": "failed",
                    "message": {
                        "role": "assistant",
                        "parts": [{"text": "Unknown response type"}]
                    }
                }
            })

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/reset")
async def reset_state():
    """Reset all session state - useful between test runs."""
    global sessions
    sessions = {}
    return {"ok": True, "message": "State reset"}


@app.get("/sessions")
async def get_sessions():
    """Get all active sessions - useful for debugging."""
    return {
        "sessions": [
            {
                "session_id": s.session_id,
                "workflow_id": s.workflow_id,
                "current_phase": s.current_phase,
                "created_at": s.created_at
            }
            for s in sessions.values()
        ]
    }


# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=TEST_AGENT_PORT,
        log_level="info"
    )
