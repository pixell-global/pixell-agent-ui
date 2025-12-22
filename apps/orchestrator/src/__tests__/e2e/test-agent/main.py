#!/usr/bin/env python3
"""
Minimal Test Agent for E2E Tests

This agent immediately creates a test file when it receives any message,
without going through plan-mode or clarification questions.
Used to test the file upload flow from agent -> orchestrator -> S3.
"""

import os
import sys
import asyncio
from datetime import datetime
from pathlib import Path

# Add pixell-sdk to path (assumes it's installed or available)
sys.path.insert(0, '/Users/syum/dev/pixell-sdk')

from pixell.sdk import AgentServer, MessageContext

# Create exports directory
EXPORTS_DIR = Path(__file__).parent / "exports"
EXPORTS_DIR.mkdir(exist_ok=True)

# Get port from environment variable
PORT = int(os.environ.get("PORT", "8001"))

# Create the agent server with outputs_dir configured
server = AgentServer(
    agent_id="test-file-agent",
    name="Test File Agent",
    description="Minimal agent for testing file creation flow",
    outputs_dir="exports",  # SDK auto-creates /files/download endpoint
    port=PORT,
    host="0.0.0.0",
)


@server.on_message
async def handle_message(ctx: MessageContext) -> None:
    """Handle incoming messages by creating a test file."""

    # Emit working status
    await ctx.stream.emit_status("working", "Creating test file...")

    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"test_output_{timestamp}.html"
    filepath = EXPORTS_DIR / filename

    # Create test HTML content
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>Test File Output</title>
</head>
<body>
    <h1>Test File Created</h1>
    <p>This file was created by the test agent.</p>
    <p>Message received: {ctx.message}</p>
    <p>Timestamp: {datetime.now().isoformat()}</p>
    <p>Session ID: {ctx.session_id}</p>
</body>
</html>"""

    # Write the file
    filepath.write_text(html_content)

    # Emit file_created event using the SDK helper
    await ctx.emit_file_created(
        path=filename,  # Relative path within exports
        name=filename,
        format="html",
        summary="Test file created for E2E testing",
        size=len(html_content),
    )

    # Emit completion
    await ctx.stream.emit_status("completed", "Test file created successfully!")

    # Send final response
    await ctx.stream.emit_artifact(
        "text",
        f"Created test file: {filename}",
        title="File Created",
    )


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO)

    print(f"Starting Test File Agent on port {PORT}...")
    server.run()
