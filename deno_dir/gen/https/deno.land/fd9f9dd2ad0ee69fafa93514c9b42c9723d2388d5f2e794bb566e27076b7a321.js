import { Buffer } from "../../buffer.ts";
import { createHash } from "../hash.ts";
export function EVP_BytesToKey(password, salt, keyBits, ivLen) {
    if (!Buffer.isBuffer(password))
        password = Buffer.from(password, "binary");
    if (salt) {
        if (!Buffer.isBuffer(salt))
            salt = Buffer.from(salt, "binary");
        if (salt.length !== 8) {
            throw new RangeError("salt should be Buffer with 8 byte length");
        }
    }
    let keyLen = keyBits / 8;
    const key = Buffer.alloc(keyLen);
    const iv = Buffer.alloc(ivLen || 0);
    let tmp = Buffer.alloc(0);
    while (keyLen > 0 || ivLen > 0) {
        const hash = createHash("md5");
        hash.update(tmp);
        hash.update(password);
        if (salt)
            hash.update(salt);
        tmp = hash.digest();
        let used = 0;
        if (keyLen > 0) {
            const keyStart = key.length - keyLen;
            used = Math.min(keyLen, tmp.length);
            tmp.copy(key, keyStart, 0, used);
            keyLen -= used;
        }
        if (used < tmp.length && ivLen > 0) {
            const ivStart = iv.length - ivLen;
            const length = Math.min(ivLen, tmp.length - used);
            tmp.copy(iv, ivStart, used, used + length);
            ivLen -= length;
        }
    }
    tmp.fill(0);
    return { key, iv };
}
export default EVP_BytesToKey;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZwX2J5dGVzX3RvX2tleS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImV2cF9ieXRlc190b19rZXkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBR0EsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3pDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFeEMsTUFBTSxVQUFVLGNBQWMsQ0FDNUIsUUFBeUIsRUFDekIsSUFBcUIsRUFDckIsT0FBZSxFQUNmLEtBQWE7SUFFYixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7UUFBRSxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDM0UsSUFBSSxJQUFJLEVBQUU7UUFDUixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7WUFBRSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDL0QsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNyQixNQUFNLElBQUksVUFBVSxDQUFDLDBDQUEwQyxDQUFDLENBQUM7U0FDbEU7S0FDRjtJQUVELElBQUksTUFBTSxHQUFHLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDekIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNqQyxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNwQyxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTFCLE9BQU8sTUFBTSxHQUFHLENBQUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFO1FBQzlCLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdEIsSUFBSSxJQUFJO1lBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1QixHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBWSxDQUFDO1FBRTlCLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztRQUViLElBQUksTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNkLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQ3JDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDcEMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNqQyxNQUFNLElBQUksSUFBSSxDQUFDO1NBQ2hCO1FBRUQsSUFBSSxJQUFJLEdBQUcsR0FBRyxDQUFDLE1BQU0sSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFO1lBQ2xDLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO1lBQ2xDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDbEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUM7WUFDM0MsS0FBSyxJQUFJLE1BQU0sQ0FBQztTQUNqQjtLQUNGO0lBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNaLE9BQU8sRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLENBQUM7QUFDckIsQ0FBQztBQUVELGVBQWUsY0FBYyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCAyMDE3IGNyeXB0by1icm93c2VyaWZ5LiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uLy4uL2J1ZmZlci50c1wiO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gXCIuLi9oYXNoLnRzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBFVlBfQnl0ZXNUb0tleShcbiAgcGFzc3dvcmQ6IHN0cmluZyB8IEJ1ZmZlcixcbiAgc2FsdDogc3RyaW5nIHwgQnVmZmVyLFxuICBrZXlCaXRzOiBudW1iZXIsXG4gIGl2TGVuOiBudW1iZXIsXG4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIocGFzc3dvcmQpKSBwYXNzd29yZCA9IEJ1ZmZlci5mcm9tKHBhc3N3b3JkLCBcImJpbmFyeVwiKTtcbiAgaWYgKHNhbHQpIHtcbiAgICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihzYWx0KSkgc2FsdCA9IEJ1ZmZlci5mcm9tKHNhbHQsIFwiYmluYXJ5XCIpO1xuICAgIGlmIChzYWx0Lmxlbmd0aCAhPT0gOCkge1xuICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJzYWx0IHNob3VsZCBiZSBCdWZmZXIgd2l0aCA4IGJ5dGUgbGVuZ3RoXCIpO1xuICAgIH1cbiAgfVxuXG4gIGxldCBrZXlMZW4gPSBrZXlCaXRzIC8gODtcbiAgY29uc3Qga2V5ID0gQnVmZmVyLmFsbG9jKGtleUxlbik7XG4gIGNvbnN0IGl2ID0gQnVmZmVyLmFsbG9jKGl2TGVuIHx8IDApO1xuICBsZXQgdG1wID0gQnVmZmVyLmFsbG9jKDApO1xuXG4gIHdoaWxlIChrZXlMZW4gPiAwIHx8IGl2TGVuID4gMCkge1xuICAgIGNvbnN0IGhhc2ggPSBjcmVhdGVIYXNoKFwibWQ1XCIpO1xuICAgIGhhc2gudXBkYXRlKHRtcCk7XG4gICAgaGFzaC51cGRhdGUocGFzc3dvcmQpO1xuICAgIGlmIChzYWx0KSBoYXNoLnVwZGF0ZShzYWx0KTtcbiAgICB0bXAgPSBoYXNoLmRpZ2VzdCgpIGFzIEJ1ZmZlcjtcblxuICAgIGxldCB1c2VkID0gMDtcblxuICAgIGlmIChrZXlMZW4gPiAwKSB7XG4gICAgICBjb25zdCBrZXlTdGFydCA9IGtleS5sZW5ndGggLSBrZXlMZW47XG4gICAgICB1c2VkID0gTWF0aC5taW4oa2V5TGVuLCB0bXAubGVuZ3RoKTtcbiAgICAgIHRtcC5jb3B5KGtleSwga2V5U3RhcnQsIDAsIHVzZWQpO1xuICAgICAga2V5TGVuIC09IHVzZWQ7XG4gICAgfVxuXG4gICAgaWYgKHVzZWQgPCB0bXAubGVuZ3RoICYmIGl2TGVuID4gMCkge1xuICAgICAgY29uc3QgaXZTdGFydCA9IGl2Lmxlbmd0aCAtIGl2TGVuO1xuICAgICAgY29uc3QgbGVuZ3RoID0gTWF0aC5taW4oaXZMZW4sIHRtcC5sZW5ndGggLSB1c2VkKTtcbiAgICAgIHRtcC5jb3B5KGl2LCBpdlN0YXJ0LCB1c2VkLCB1c2VkICsgbGVuZ3RoKTtcbiAgICAgIGl2TGVuIC09IGxlbmd0aDtcbiAgICB9XG4gIH1cblxuICB0bXAuZmlsbCgwKTtcbiAgcmV0dXJuIHsga2V5LCBpdiB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBFVlBfQnl0ZXNUb0tleTtcbiJdfQ==