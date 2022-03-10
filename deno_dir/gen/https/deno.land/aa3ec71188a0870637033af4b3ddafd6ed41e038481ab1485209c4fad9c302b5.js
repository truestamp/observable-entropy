import randomBytes, { MAX_SIZE as kMaxUint32 } from "./randomBytes.ts";
const kBufferMaxLength = 0x7fffffff;
function assertOffset(offset, length) {
    if (offset > kMaxUint32 || offset < 0) {
        throw new TypeError("offset must be a uint32");
    }
    if (offset > kBufferMaxLength || offset > length) {
        throw new RangeError("offset out of range");
    }
}
function assertSize(size, offset, length) {
    if (size > kMaxUint32 || size < 0) {
        throw new TypeError("size must be a uint32");
    }
    if (size + offset > length || size > kBufferMaxLength) {
        throw new RangeError("buffer too small");
    }
}
export default function randomFill(buf, offset, size, cb) {
    if (typeof offset === "function") {
        cb = offset;
        offset = 0;
        size = buf.length;
    }
    else if (typeof size === "function") {
        cb = size;
        size = buf.length - Number(offset);
    }
    assertOffset(offset, buf.length);
    assertSize(size, offset, buf.length);
    randomBytes(size, (err, bytes) => {
        if (err)
            return cb(err, buf);
        bytes?.copy(buf, offset);
        cb(null, buf);
    });
}
export function randomFillSync(buf, offset = 0, size) {
    assertOffset(offset, buf.length);
    if (size === undefined)
        size = buf.length - offset;
    assertSize(size, offset, buf.length);
    const bytes = randomBytes(size);
    bytes.copy(buf, offset);
    return buf;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFuZG9tRmlsbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJhbmRvbUZpbGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxXQUFXLEVBQUUsRUFBRSxRQUFRLElBQUksVUFBVSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFHdkUsTUFBTSxnQkFBZ0IsR0FBRyxVQUFVLENBQUM7QUFFcEMsU0FBUyxZQUFZLENBQUMsTUFBYyxFQUFFLE1BQWM7SUFDbEQsSUFBSSxNQUFNLEdBQUcsVUFBVSxJQUFJLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDckMsTUFBTSxJQUFJLFNBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0tBQ2hEO0lBRUQsSUFBSSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksTUFBTSxHQUFHLE1BQU0sRUFBRTtRQUNoRCxNQUFNLElBQUksVUFBVSxDQUFDLHFCQUFxQixDQUFDLENBQUM7S0FDN0M7QUFDSCxDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsSUFBWSxFQUFFLE1BQWMsRUFBRSxNQUFjO0lBQzlELElBQUksSUFBSSxHQUFHLFVBQVUsSUFBSSxJQUFJLEdBQUcsQ0FBQyxFQUFFO1FBQ2pDLE1BQU0sSUFBSSxTQUFTLENBQUMsdUJBQXVCLENBQUMsQ0FBQztLQUM5QztJQUVELElBQUksSUFBSSxHQUFHLE1BQU0sR0FBRyxNQUFNLElBQUksSUFBSSxHQUFHLGdCQUFnQixFQUFFO1FBQ3JELE1BQU0sSUFBSSxVQUFVLENBQUMsa0JBQWtCLENBQUMsQ0FBQztLQUMxQztBQUNILENBQUM7QUFvQkQsTUFBTSxDQUFDLE9BQU8sVUFBVSxVQUFVLENBQ2hDLEdBQVcsRUFDWCxNQUE0RCxFQUM1RCxJQUEwRCxFQUMxRCxFQUErQztJQUUvQyxJQUFJLE9BQU8sTUFBTSxLQUFLLFVBQVUsRUFBRTtRQUNoQyxFQUFFLEdBQUcsTUFBTSxDQUFDO1FBQ1osTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNYLElBQUksR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0tBQ25CO1NBQU0sSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUU7UUFDckMsRUFBRSxHQUFHLElBQUksQ0FBQztRQUNWLElBQUksR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFnQixDQUFDLENBQUM7S0FDOUM7SUFFRCxZQUFZLENBQUMsTUFBZ0IsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDM0MsVUFBVSxDQUFDLElBQWMsRUFBRSxNQUFnQixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUV6RCxXQUFXLENBQUMsSUFBYyxFQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFO1FBQ3pDLElBQUksR0FBRztZQUFFLE9BQU8sRUFBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUM5QixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFnQixDQUFDLENBQUM7UUFDbkMsRUFBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNqQixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxNQUFNLFVBQVUsY0FBYyxDQUFDLEdBQVcsRUFBRSxNQUFNLEdBQUcsQ0FBQyxFQUFFLElBQWE7SUFDbkUsWUFBWSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFakMsSUFBSSxJQUFJLEtBQUssU0FBUztRQUFFLElBQUksR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUVuRCxVQUFVLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFckMsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRWhDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBRXhCLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgcmFuZG9tQnl0ZXMsIHsgTUFYX1NJWkUgYXMga01heFVpbnQzMiB9IGZyb20gXCIuL3JhbmRvbUJ5dGVzLnRzXCI7XG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vYnVmZmVyLnRzXCI7XG5cbmNvbnN0IGtCdWZmZXJNYXhMZW5ndGggPSAweDdmZmZmZmZmO1xuXG5mdW5jdGlvbiBhc3NlcnRPZmZzZXQob2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKSB7XG4gIGlmIChvZmZzZXQgPiBrTWF4VWludDMyIHx8IG9mZnNldCA8IDApIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwib2Zmc2V0IG11c3QgYmUgYSB1aW50MzJcIik7XG4gIH1cblxuICBpZiAob2Zmc2V0ID4ga0J1ZmZlck1heExlbmd0aCB8fCBvZmZzZXQgPiBsZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIm9mZnNldCBvdXQgb2YgcmFuZ2VcIik7XG4gIH1cbn1cblxuZnVuY3Rpb24gYXNzZXJ0U2l6ZShzaXplOiBudW1iZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikge1xuICBpZiAoc2l6ZSA+IGtNYXhVaW50MzIgfHwgc2l6ZSA8IDApIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwic2l6ZSBtdXN0IGJlIGEgdWludDMyXCIpO1xuICB9XG5cbiAgaWYgKHNpemUgKyBvZmZzZXQgPiBsZW5ndGggfHwgc2l6ZSA+IGtCdWZmZXJNYXhMZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcImJ1ZmZlciB0b28gc21hbGxcIik7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmFuZG9tRmlsbChcbiAgYnVmOiBCdWZmZXIsXG4gIGNiOiAoZXJyOiBFcnJvciB8IG51bGwsIGJ1ZjogQnVmZmVyKSA9PiB2b2lkLFxuKTogdm9pZDtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmFuZG9tRmlsbChcbiAgYnVmOiBCdWZmZXIsXG4gIG9mZnNldDogbnVtYmVyLFxuICBjYjogKChlcnI6IEVycm9yIHwgbnVsbCwgYnVmOiBCdWZmZXIpID0+IHZvaWQpLFxuKTogdm9pZDtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmFuZG9tRmlsbChcbiAgYnVmOiBCdWZmZXIsXG4gIG9mZnNldDogbnVtYmVyLFxuICBzaXplOiBudW1iZXIsXG4gIGNiOiAoZXJyOiBFcnJvciB8IG51bGwsIGJ1ZjogQnVmZmVyKSA9PiB2b2lkLFxuKTogdm9pZDtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmFuZG9tRmlsbChcbiAgYnVmOiBCdWZmZXIsXG4gIG9mZnNldD86IG51bWJlciB8ICgoZXJyOiBFcnJvciB8IG51bGwsIGJ1ZjogQnVmZmVyKSA9PiB2b2lkKSxcbiAgc2l6ZT86IG51bWJlciB8ICgoZXJyOiBFcnJvciB8IG51bGwsIGJ1ZjogQnVmZmVyKSA9PiB2b2lkKSxcbiAgY2I/OiAoKGVycjogRXJyb3IgfCBudWxsLCBidWY6IEJ1ZmZlcikgPT4gdm9pZCksXG4pOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBvZmZzZXQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNiID0gb2Zmc2V0O1xuICAgIG9mZnNldCA9IDA7XG4gICAgc2l6ZSA9IGJ1Zi5sZW5ndGg7XG4gIH0gZWxzZSBpZiAodHlwZW9mIHNpemUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIGNiID0gc2l6ZTtcbiAgICBzaXplID0gYnVmLmxlbmd0aCAtIE51bWJlcihvZmZzZXQgYXMgbnVtYmVyKTtcbiAgfVxuXG4gIGFzc2VydE9mZnNldChvZmZzZXQgYXMgbnVtYmVyLCBidWYubGVuZ3RoKTtcbiAgYXNzZXJ0U2l6ZShzaXplIGFzIG51bWJlciwgb2Zmc2V0IGFzIG51bWJlciwgYnVmLmxlbmd0aCk7XG5cbiAgcmFuZG9tQnl0ZXMoc2l6ZSBhcyBudW1iZXIsIChlcnIsIGJ5dGVzKSA9PiB7XG4gICAgaWYgKGVycikgcmV0dXJuIGNiIShlcnIsIGJ1Zik7XG4gICAgYnl0ZXM/LmNvcHkoYnVmLCBvZmZzZXQgYXMgbnVtYmVyKTtcbiAgICBjYiEobnVsbCwgYnVmKTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByYW5kb21GaWxsU3luYyhidWY6IEJ1ZmZlciwgb2Zmc2V0ID0gMCwgc2l6ZT86IG51bWJlcikge1xuICBhc3NlcnRPZmZzZXQob2Zmc2V0LCBidWYubGVuZ3RoKTtcblxuICBpZiAoc2l6ZSA9PT0gdW5kZWZpbmVkKSBzaXplID0gYnVmLmxlbmd0aCAtIG9mZnNldDtcblxuICBhc3NlcnRTaXplKHNpemUsIG9mZnNldCwgYnVmLmxlbmd0aCk7XG5cbiAgY29uc3QgYnl0ZXMgPSByYW5kb21CeXRlcyhzaXplKTtcblxuICBieXRlcy5jb3B5KGJ1Ziwgb2Zmc2V0KTtcblxuICByZXR1cm4gYnVmO1xufVxuIl19