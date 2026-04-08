import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8000/ws/call/test-room"
    try:
        async with websockets.connect(uri) as ws1:
            res1 = await ws1.recv()
            print(f"WS1 first msg: {res1}")

            async with websockets.connect(uri) as ws2:
                res2 = await ws2.recv()
                print(f"WS2 first msg: {res2}")

                res1_update = await ws1.recv()
                print(f"WS1 updated msg: {res1_update}")

                try:
                    async with websockets.connect(uri) as ws3:
                        res3 = await ws3.recv()
                        print(f"WS3 received before close: {res3}")
                except websockets.exceptions.ConnectionClosed as e:
                    print("WS3 connection closed properly.")
                except Exception as e:
                    print(f"WS3 unexpected error: {e}")

            res1_final = await ws1.recv()
            print(f"WS1 final msg: {res1_final}")

    except Exception as e:
        print(f"Test failed with error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
