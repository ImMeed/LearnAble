"""
Phase 01 Manual Test — Signaling & Room Logic
Spins up a minimal FastAPI server with ONLY the call router,
then runs WebSocket tests against it.
"""

import asyncio
import json
import threading
import time

import uvicorn
from fastapi import FastAPI

# Import just the call router
from app.modules.call.router import router as call_router

# ---------- Minimal test server ----------
test_app = FastAPI()
test_app.include_router(call_router)

TEST_PORT = 9999


def start_server():
    uvicorn.run(test_app, host="127.0.0.1", port=TEST_PORT, log_level="warning")


# ---------- Tests ----------
async def run_tests():
    from websockets.asyncio.client import connect

    uri = f"ws://127.0.0.1:{TEST_PORT}/ws/call/test-room"
    passed = 0
    failed = 0

    def check(label, condition):
        nonlocal passed, failed
        if condition:
            print(f"  ✅ {label}")
            passed += 1
        else:
            print(f"  ❌ {label}")
            failed += 1

    # --- Test 1: First client joins ---
    print("\n[Test 1] First client connects")
    ws1 = await connect(uri)
    msg1 = json.loads(await ws1.recv())
    print(f"  Received: {msg1}")
    check("type == 'joined'", msg1["type"] == "joined")
    check("initiator == True (first joiner)", msg1.get("initiator") is True)

    # --- Test 2: Second client joins ---
    print("\n[Test 2] Second client connects")
    ws2 = await connect(uri)
    msg2 = json.loads(await ws2.recv())
    print(f"  Received: {msg2}")
    check("type == 'joined'", msg2["type"] == "joined")
    check("initiator == False (second joiner)", msg2.get("initiator") is False)

    # First client should get peer_joined
    msg1_update = json.loads(await ws1.recv())
    print(f"  Client 1 got: {msg1_update}")
    check("Client 1 receives 'peer_joined'", msg1_update["type"] == "peer_joined")

    # --- Test 3: Third client gets room_full ---
    print("\n[Test 3] Third client connects (should be rejected)")
    ws3 = await connect(uri)
    msg3 = json.loads(await ws3.recv())
    print(f"  Received: {msg3}")
    check("type == 'room_full'", msg3["type"] == "room_full")
    # Wait for server to close ws3
    try:
        await asyncio.wait_for(ws3.recv(), timeout=2)
    except Exception:
        pass
    from websockets.protocol import State
    check("Connection closed by server", ws3.state == State.CLOSED)

    # --- Test 4: Message relay (offer) ---
    print("\n[Test 4] Client 2 sends an offer → relayed to Client 1")
    await ws2.send(json.dumps({"type": "offer", "sdp": "fake_sdp_offer"}))
    relayed = json.loads(await asyncio.wait_for(ws1.recv(), timeout=3))
    print(f"  Client 1 got: {relayed}")
    check("Offer relayed correctly", relayed["type"] == "offer" and relayed["sdp"] == "fake_sdp_offer")

    # --- Test 5: Message relay (answer) ---
    print("\n[Test 5] Client 1 sends an answer → relayed to Client 2")
    await ws1.send(json.dumps({"type": "answer", "sdp": "fake_sdp_answer"}))
    relayed2 = json.loads(await asyncio.wait_for(ws2.recv(), timeout=3))
    print(f"  Client 2 got: {relayed2}")
    check("Answer relayed correctly", relayed2["type"] == "answer" and relayed2["sdp"] == "fake_sdp_answer")

    # --- Test 6: ICE candidate relay ---
    print("\n[Test 6] Client 2 sends ICE candidate → relayed to Client 1")
    await ws2.send(json.dumps({"type": "ice", "candidate": {"sdpMid": "0"}}))
    relayed3 = json.loads(await asyncio.wait_for(ws1.recv(), timeout=3))
    print(f"  Client 1 got: {relayed3}")
    check("ICE candidate relayed", relayed3["type"] == "ice")

    # --- Test 7: Peer disconnect ---
    print("\n[Test 7] Client 2 disconnects → Client 1 gets peer_left")
    await ws2.close()
    msg_left = json.loads(await asyncio.wait_for(ws1.recv(), timeout=3))
    print(f"  Client 1 got: {msg_left}")
    check("peer_left received", msg_left["type"] == "peer_left")

    await ws1.close()

    # --- Summary ---
    total = passed + failed
    print(f"\n{'='*50}")
    print(f"Phase 01 Test Results: {passed}/{total} passed")
    if failed == 0:
        print("✅ All tests passed!")
    else:
        print(f"❌ {failed} test(s) failed")
    print(f"{'='*50}")


if __name__ == "__main__":
    # Start server in background thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(1)  # Give server time to start

    # Run tests
    asyncio.run(run_tests())
