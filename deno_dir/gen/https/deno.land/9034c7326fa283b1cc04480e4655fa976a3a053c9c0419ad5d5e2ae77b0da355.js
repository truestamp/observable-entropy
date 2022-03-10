import { Buffer } from "../buffer.ts";
export const MAX_RANDOM_VALUES = 65536;
export const MAX_SIZE = 4294967295;
function generateRandomBytes(size) {
    if (size > MAX_SIZE) {
        throw new RangeError(`The value of "size" is out of range. It must be >= 0 && <= ${MAX_SIZE}. Received ${size}`);
    }
    const bytes = Buffer.allocUnsafe(size);
    if (size > MAX_RANDOM_VALUES) {
        for (let generated = 0; generated < size; generated += MAX_RANDOM_VALUES) {
            crypto.getRandomValues(bytes.slice(generated, generated + MAX_RANDOM_VALUES));
        }
    }
    else {
        crypto.getRandomValues(bytes);
    }
    return bytes;
}
export default function randomBytes(size, cb) {
    if (typeof cb === "function") {
        let err = null, bytes;
        try {
            bytes = generateRandomBytes(size);
        }
        catch (e) {
            if (e instanceof RangeError &&
                e.message.includes('The value of "size" is out of range')) {
                throw e;
            }
            else if (e instanceof Error) {
                err = e;
            }
            else {
                err = new Error("[non-error thrown]");
            }
        }
        setTimeout(() => {
            if (err) {
                cb(err);
            }
            else {
                cb(null, bytes);
            }
        }, 0);
    }
    else {
        return generateRandomBytes(size);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFuZG9tQnl0ZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyYW5kb21CeXRlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBRXRDLE1BQU0sQ0FBQyxNQUFNLGlCQUFpQixHQUFHLEtBQUssQ0FBQztBQUN2QyxNQUFNLENBQUMsTUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDO0FBRW5DLFNBQVMsbUJBQW1CLENBQUMsSUFBWTtJQUN2QyxJQUFJLElBQUksR0FBRyxRQUFRLEVBQUU7UUFDbkIsTUFBTSxJQUFJLFVBQVUsQ0FDbEIsOERBQThELFFBQVEsY0FBYyxJQUFJLEVBQUUsQ0FDM0YsQ0FBQztLQUNIO0lBRUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUd2QyxJQUFJLElBQUksR0FBRyxpQkFBaUIsRUFBRTtRQUM1QixLQUFLLElBQUksU0FBUyxHQUFHLENBQUMsRUFBRSxTQUFTLEdBQUcsSUFBSSxFQUFFLFNBQVMsSUFBSSxpQkFBaUIsRUFBRTtZQUN4RSxNQUFNLENBQUMsZUFBZSxDQUNwQixLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxTQUFTLEdBQUcsaUJBQWlCLENBQUMsQ0FDdEQsQ0FBQztTQUNIO0tBQ0Y7U0FBTTtRQUNMLE1BQU0sQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDL0I7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFVRCxNQUFNLENBQUMsT0FBTyxVQUFVLFdBQVcsQ0FDakMsSUFBWSxFQUNaLEVBQThDO0lBRTlDLElBQUksT0FBTyxFQUFFLEtBQUssVUFBVSxFQUFFO1FBQzVCLElBQUksR0FBRyxHQUFpQixJQUFJLEVBQUUsS0FBYSxDQUFDO1FBQzVDLElBQUk7WUFDRixLQUFLLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDbkM7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUdWLElBQ0UsQ0FBQyxZQUFZLFVBQVU7Z0JBQ3ZCLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLHFDQUFxQyxDQUFDLEVBQ3pEO2dCQUNBLE1BQU0sQ0FBQyxDQUFDO2FBQ1Q7aUJBQU0sSUFBSSxDQUFDLFlBQVksS0FBSyxFQUFFO2dCQUM3QixHQUFHLEdBQUcsQ0FBQyxDQUFDO2FBQ1Q7aUJBQU07Z0JBQ0wsR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUM7YUFDdkM7U0FDRjtRQUNELFVBQVUsQ0FBQyxHQUFHLEVBQUU7WUFDZCxJQUFJLEdBQUcsRUFBRTtnQkFDUCxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDVDtpQkFBTTtnQkFDTCxFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQ2pCO1FBQ0gsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ1A7U0FBTTtRQUNMLE9BQU8sbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDbEM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmltcG9ydCB7IEJ1ZmZlciB9IGZyb20gXCIuLi9idWZmZXIudHNcIjtcblxuZXhwb3J0IGNvbnN0IE1BWF9SQU5ET01fVkFMVUVTID0gNjU1MzY7XG5leHBvcnQgY29uc3QgTUFYX1NJWkUgPSA0Mjk0OTY3Mjk1O1xuXG5mdW5jdGlvbiBnZW5lcmF0ZVJhbmRvbUJ5dGVzKHNpemU6IG51bWJlcikge1xuICBpZiAoc2l6ZSA+IE1BWF9TSVpFKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXG4gICAgICBgVGhlIHZhbHVlIG9mIFwic2l6ZVwiIGlzIG91dCBvZiByYW5nZS4gSXQgbXVzdCBiZSA+PSAwICYmIDw9ICR7TUFYX1NJWkV9LiBSZWNlaXZlZCAke3NpemV9YCxcbiAgICApO1xuICB9XG5cbiAgY29uc3QgYnl0ZXMgPSBCdWZmZXIuYWxsb2NVbnNhZmUoc2l6ZSk7XG5cbiAgLy9Xb3JrIGFyb3VuZCBmb3IgZ2V0UmFuZG9tVmFsdWVzIG1heCBnZW5lcmF0aW9uXG4gIGlmIChzaXplID4gTUFYX1JBTkRPTV9WQUxVRVMpIHtcbiAgICBmb3IgKGxldCBnZW5lcmF0ZWQgPSAwOyBnZW5lcmF0ZWQgPCBzaXplOyBnZW5lcmF0ZWQgKz0gTUFYX1JBTkRPTV9WQUxVRVMpIHtcbiAgICAgIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMoXG4gICAgICAgIGJ5dGVzLnNsaWNlKGdlbmVyYXRlZCwgZ2VuZXJhdGVkICsgTUFYX1JBTkRPTV9WQUxVRVMpLFxuICAgICAgKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhieXRlcyk7XG4gIH1cblxuICByZXR1cm4gYnl0ZXM7XG59XG5cbi8qKlxuICogQHBhcmFtIHNpemUgQnVmZmVyIGxlbmd0aCwgbXVzdCBiZSBlcXVhbCBvciBncmVhdGVyIHRoYW4gemVyb1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByYW5kb21CeXRlcyhzaXplOiBudW1iZXIpOiBCdWZmZXI7XG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByYW5kb21CeXRlcyhcbiAgc2l6ZTogbnVtYmVyLFxuICBjYj86IChlcnI6IEVycm9yIHwgbnVsbCwgYnVmPzogQnVmZmVyKSA9PiB2b2lkLFxuKTogdm9pZDtcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJhbmRvbUJ5dGVzKFxuICBzaXplOiBudW1iZXIsXG4gIGNiPzogKGVycjogRXJyb3IgfCBudWxsLCBidWY/OiBCdWZmZXIpID0+IHZvaWQsXG4pOiBCdWZmZXIgfCB2b2lkIHtcbiAgaWYgKHR5cGVvZiBjYiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgbGV0IGVycjogRXJyb3IgfCBudWxsID0gbnVsbCwgYnl0ZXM6IEJ1ZmZlcjtcbiAgICB0cnkge1xuICAgICAgYnl0ZXMgPSBnZW5lcmF0ZVJhbmRvbUJ5dGVzKHNpemUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vTm9kZUpTIG5vbnNlbnNlXG4gICAgICAvL0lmIHRoZSBzaXplIGlzIG91dCBvZiByYW5nZSBpdCB3aWxsIHRocm93IHN5bmMsIG90aGVyd2lzZSB0aHJvdyBhc3luY1xuICAgICAgaWYgKFxuICAgICAgICBlIGluc3RhbmNlb2YgUmFuZ2VFcnJvciAmJlxuICAgICAgICBlLm1lc3NhZ2UuaW5jbHVkZXMoJ1RoZSB2YWx1ZSBvZiBcInNpemVcIiBpcyBvdXQgb2YgcmFuZ2UnKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9IGVsc2UgaWYgKGUgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICBlcnIgPSBlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXJyID0gbmV3IEVycm9yKFwiW25vbi1lcnJvciB0aHJvd25dXCIpO1xuICAgICAgfVxuICAgIH1cbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgY2IoZXJyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNiKG51bGwsIGJ5dGVzKTtcbiAgICAgIH1cbiAgICB9LCAwKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZ2VuZXJhdGVSYW5kb21CeXRlcyhzaXplKTtcbiAgfVxufVxuIl19