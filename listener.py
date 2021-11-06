#! /usr/bin/env python3

# import asyncio
# from bleak import BleakClient

# address = "c8:ef:6a:ea:2b:fe"
# FAST_DATA_UUID = "f8b23a4d-89ad-4220-8c9f-d81756009f0c"
# SLOW_DATA_UUID = "f8b23a4d-89ad-4220-8c9f-d81756009f0d"

# async def main(address):
#     client = BleakClient(address)
#     try:
#         await client.connect()
#         fast_data = await client.read_gatt_char(FAST_DATA_UUID)
#         print("Fast data: {}".format(''.join('{:02x}'.format(x) for x in fast_data)))
#         fast_data = await client.read_gatt_char(SLOW_DATA_UUID)
#         print("Slow data: {}".format(''.join('{:02x}'.format(x) for x in fast_data)))
#     except Exception as e:
#         print(e)
#     finally:
#         await client.disconnect()

# loop = asyncio.get_event_loop()
# loop.run_until_complete(run(address, loop))


import asyncio
import array
import struct

from bleak import BleakClient

address = "6DC28E96-A254-4B85-9014-E828E0437EA1"
FAST_DATA_UUID = "f8b23a4d-89ad-4220-8c9f-d81756009f0c"
SLOW_DATA_UUID = "f8b23a4d-89ad-4220-8c9f-d81756009f0d"

fast_counter = 0
slow_counter = 0

def fast_data_received(sender, data):
    global fast_counter
    fast_counter += 1
    print("Fast data: {}".format(''.join('{:02x}'.format(x) for x in data)))

def slow_data_received(sender, data):
    global slow_counter
    slow_counter += 1
    print("Slow data: {}".format(''.join('{:02x}'.format(x) for x in data)))

print("Connecting...")
async def run(address, loop):
    async with BleakClient(address, loop=loop) as client:
        #print("Writing command")
        #await client.write_gatt_char(FAST_DATA_UUID, bytearray(struct.pack("!f", 104.0)), False)
        #await client.write_gatt_char(SLOW_DATA_UUID, bytearray(struct.pack("!f", 5.0)), False)
        print("Connected")
        await client.start_notify(FAST_DATA_UUID, fast_data_received)
        await client.start_notify(SLOW_DATA_UUID, slow_data_received)
        print("Waiting for data")
        await asyncio.sleep(30.0, loop=loop) # wait for a response
        global fast_counter
        global slow_counter
        print("Rates")
        print("- fast: {} Hz".format(fast_counter/30))
        print("- slow: {} Hz".format(slow_counter/30))
        print("Done!")

loop = asyncio.get_event_loop()
loop.run_until_complete(run(address, loop))


# import asyncio
# from bleak import BleakScanner

# async def main():
#     devices = await BleakScanner.discover()
#     for d in devices:
#         print(d)

# asyncio.run(main())