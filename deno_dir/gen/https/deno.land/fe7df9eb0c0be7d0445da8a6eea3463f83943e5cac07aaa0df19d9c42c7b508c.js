// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright 2017 crypto-browserify. All rights reserved. MIT license.
import { Buffer } from "../../buffer.ts";
import { nextTick } from "../../_next_tick.ts";
// limit of Crypto.getRandomValues()
// https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
const MAX_BYTES = 65536;
// Node supports requesting up to this number of bytes
// https://github.com/nodejs/node/blob/master/lib/internal/crypto/random.js#L48
const MAX_UINT32 = 4294967295;
export function randomBytes(size, cb) {
    // phantomjs needs to throw
    if (size > MAX_UINT32) {
        throw new RangeError("requested too many random bytes");
    }
    const bytes = Buffer.allocUnsafe(size);
    if (size > 0) {
        if (size > MAX_BYTES) {
            // can do at once see https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
            for(let generated = 0; generated < size; generated += MAX_BYTES){
                // buffer.slice automatically checks if the end is past the end of
                // the buffer so we don't have to here
                crypto.getRandomValues(bytes.slice(generated, generated + MAX_BYTES));
            }
        } else {
            crypto.getRandomValues(bytes);
        }
    }
    if (typeof cb === "function") {
        return nextTick(function() {
            cb(null, bytes);
        });
    }
    return bytes;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL25vZGUvX2NyeXB0by9jcnlwdG9fYnJvd3NlcmlmeS9yYW5kb21ieXRlcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IDIwMTcgY3J5cHRvLWJyb3dzZXJpZnkuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uLy4uL2J1ZmZlci50c1wiO1xuaW1wb3J0IHsgbmV4dFRpY2sgfSBmcm9tIFwiLi4vLi4vX25leHRfdGljay50c1wiO1xuXG4vLyBsaW1pdCBvZiBDcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKClcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9DcnlwdG8vZ2V0UmFuZG9tVmFsdWVzXG5jb25zdCBNQVhfQllURVMgPSA2NTUzNjtcblxuLy8gTm9kZSBzdXBwb3J0cyByZXF1ZXN0aW5nIHVwIHRvIHRoaXMgbnVtYmVyIG9mIGJ5dGVzXG4vLyBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9tYXN0ZXIvbGliL2ludGVybmFsL2NyeXB0by9yYW5kb20uanMjTDQ4XG5jb25zdCBNQVhfVUlOVDMyID0gNDI5NDk2NzI5NTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbUJ5dGVzKFxuICBzaXplOiBudW1iZXIsXG4gIGNiPzogKGVycjogRXJyb3IgfCBudWxsLCBiOiBCdWZmZXIpID0+IHZvaWQsXG4pIHtcbiAgLy8gcGhhbnRvbWpzIG5lZWRzIHRvIHRocm93XG4gIGlmIChzaXplID4gTUFYX1VJTlQzMikge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwicmVxdWVzdGVkIHRvbyBtYW55IHJhbmRvbSBieXRlc1wiKTtcbiAgfVxuXG4gIGNvbnN0IGJ5dGVzID0gQnVmZmVyLmFsbG9jVW5zYWZlKHNpemUpO1xuXG4gIGlmIChzaXplID4gMCkgeyAvLyBnZXRSYW5kb21WYWx1ZXMgZmFpbHMgb24gSUUgaWYgc2l6ZSA9PSAwXG4gICAgaWYgKHNpemUgPiBNQVhfQllURVMpIHsgLy8gdGhpcyBpcyB0aGUgbWF4IGJ5dGVzIGNyeXB0by5nZXRSYW5kb21WYWx1ZXNcbiAgICAgIC8vIGNhbiBkbyBhdCBvbmNlIHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvd2luZG93LmNyeXB0by5nZXRSYW5kb21WYWx1ZXNcbiAgICAgIGZvciAobGV0IGdlbmVyYXRlZCA9IDA7IGdlbmVyYXRlZCA8IHNpemU7IGdlbmVyYXRlZCArPSBNQVhfQllURVMpIHtcbiAgICAgICAgLy8gYnVmZmVyLnNsaWNlIGF1dG9tYXRpY2FsbHkgY2hlY2tzIGlmIHRoZSBlbmQgaXMgcGFzdCB0aGUgZW5kIG9mXG4gICAgICAgIC8vIHRoZSBidWZmZXIgc28gd2UgZG9uJ3QgaGF2ZSB0byBoZXJlXG4gICAgICAgIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMoYnl0ZXMuc2xpY2UoZ2VuZXJhdGVkLCBnZW5lcmF0ZWQgKyBNQVhfQllURVMpKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhieXRlcyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHR5cGVvZiBjYiA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcmV0dXJuIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNiKG51bGwsIGJ5dGVzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBieXRlcztcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsc0VBQXNFO0FBQ3RFLFNBQVMsTUFBTSxRQUFRLGlCQUFpQixDQUFDO0FBQ3pDLFNBQVMsUUFBUSxRQUFRLHFCQUFxQixDQUFDO0FBRS9DLG9DQUFvQztBQUNwQywwRUFBMEU7QUFDMUUsTUFBTSxTQUFTLEdBQUcsS0FBSyxBQUFDO0FBRXhCLHNEQUFzRDtBQUN0RCwrRUFBK0U7QUFDL0UsTUFBTSxVQUFVLEdBQUcsVUFBVSxBQUFDO0FBRTlCLE9BQU8sU0FBUyxXQUFXLENBQ3pCLElBQVksRUFDWixFQUEyQyxFQUMzQztJQUNBLDJCQUEyQjtJQUMzQixJQUFJLElBQUksR0FBRyxVQUFVLEVBQUU7UUFDckIsTUFBTSxJQUFJLFVBQVUsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0tBQ3pEO0lBRUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQUFBQztJQUV2QyxJQUFJLElBQUksR0FBRyxDQUFDLEVBQUU7UUFDWixJQUFJLElBQUksR0FBRyxTQUFTLEVBQUU7WUFDcEIsb0dBQW9HO1lBQ3BHLElBQUssSUFBSSxTQUFTLEdBQUcsQ0FBQyxFQUFFLFNBQVMsR0FBRyxJQUFJLEVBQUUsU0FBUyxJQUFJLFNBQVMsQ0FBRTtnQkFDaEUsa0VBQWtFO2dCQUNsRSxzQ0FBc0M7Z0JBQ3RDLE1BQU0sQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsU0FBUyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUM7YUFDdkU7U0FDRixNQUFNO1lBQ0wsTUFBTSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUMvQjtLQUNGO0lBRUQsSUFBSSxPQUFPLEVBQUUsS0FBSyxVQUFVLEVBQUU7UUFDNUIsT0FBTyxRQUFRLENBQUMsV0FBWTtZQUMxQixFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ2pCLENBQUMsQ0FBQztLQUNKO0lBRUQsT0FBTyxLQUFLLENBQUM7Q0FDZCJ9