import * as path from "../path/mod.ts";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";
import { getFileInfoType, isSubdir } from "./_util.ts";
import { assert } from "../_util/assert.ts";
import { isWindows } from "../_util/os.ts";
async function ensureValidCopy(src, dest, options) {
    let destStat;
    try {
        destStat = await Deno.lstat(dest);
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return;
        }
        throw err;
    }
    if (options.isFolder && !destStat.isDirectory) {
        throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
    }
    if (!options.overwrite) {
        throw new Error(`'${dest}' already exists.`);
    }
    return destStat;
}
function ensureValidCopySync(src, dest, options) {
    let destStat;
    try {
        destStat = Deno.lstatSync(dest);
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return;
        }
        throw err;
    }
    if (options.isFolder && !destStat.isDirectory) {
        throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
    }
    if (!options.overwrite) {
        throw new Error(`'${dest}' already exists.`);
    }
    return destStat;
}
async function copyFile(src, dest, options) {
    await ensureValidCopy(src, dest, options);
    await Deno.copyFile(src, dest);
    if (options.preserveTimestamps) {
        const statInfo = await Deno.stat(src);
        assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        await Deno.utime(dest, statInfo.atime, statInfo.mtime);
    }
}
function copyFileSync(src, dest, options) {
    ensureValidCopySync(src, dest, options);
    Deno.copyFileSync(src, dest);
    if (options.preserveTimestamps) {
        const statInfo = Deno.statSync(src);
        assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        Deno.utimeSync(dest, statInfo.atime, statInfo.mtime);
    }
}
async function copySymLink(src, dest, options) {
    await ensureValidCopy(src, dest, options);
    const originSrcFilePath = await Deno.readLink(src);
    const type = getFileInfoType(await Deno.lstat(src));
    if (isWindows) {
        await Deno.symlink(originSrcFilePath, dest, {
            type: type === "dir" ? "dir" : "file",
        });
    }
    else {
        await Deno.symlink(originSrcFilePath, dest);
    }
    if (options.preserveTimestamps) {
        const statInfo = await Deno.lstat(src);
        assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        await Deno.utime(dest, statInfo.atime, statInfo.mtime);
    }
}
function copySymlinkSync(src, dest, options) {
    ensureValidCopySync(src, dest, options);
    const originSrcFilePath = Deno.readLinkSync(src);
    const type = getFileInfoType(Deno.lstatSync(src));
    if (isWindows) {
        Deno.symlinkSync(originSrcFilePath, dest, {
            type: type === "dir" ? "dir" : "file",
        });
    }
    else {
        Deno.symlinkSync(originSrcFilePath, dest);
    }
    if (options.preserveTimestamps) {
        const statInfo = Deno.lstatSync(src);
        assert(statInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(statInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        Deno.utimeSync(dest, statInfo.atime, statInfo.mtime);
    }
}
async function copyDir(src, dest, options) {
    const destStat = await ensureValidCopy(src, dest, {
        ...options,
        isFolder: true,
    });
    if (!destStat) {
        await ensureDir(dest);
    }
    if (options.preserveTimestamps) {
        const srcStatInfo = await Deno.stat(src);
        assert(srcStatInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(srcStatInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        await Deno.utime(dest, srcStatInfo.atime, srcStatInfo.mtime);
    }
    for await (const entry of Deno.readDir(src)) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, path.basename(srcPath));
        if (entry.isSymlink) {
            await copySymLink(srcPath, destPath, options);
        }
        else if (entry.isDirectory) {
            await copyDir(srcPath, destPath, options);
        }
        else if (entry.isFile) {
            await copyFile(srcPath, destPath, options);
        }
    }
}
function copyDirSync(src, dest, options) {
    const destStat = ensureValidCopySync(src, dest, {
        ...options,
        isFolder: true,
    });
    if (!destStat) {
        ensureDirSync(dest);
    }
    if (options.preserveTimestamps) {
        const srcStatInfo = Deno.statSync(src);
        assert(srcStatInfo.atime instanceof Date, `statInfo.atime is unavailable`);
        assert(srcStatInfo.mtime instanceof Date, `statInfo.mtime is unavailable`);
        Deno.utimeSync(dest, srcStatInfo.atime, srcStatInfo.mtime);
    }
    for (const entry of Deno.readDirSync(src)) {
        assert(entry.name != null, "file.name must be set");
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, path.basename(srcPath));
        if (entry.isSymlink) {
            copySymlinkSync(srcPath, destPath, options);
        }
        else if (entry.isDirectory) {
            copyDirSync(srcPath, destPath, options);
        }
        else if (entry.isFile) {
            copyFileSync(srcPath, destPath, options);
        }
    }
}
export async function copy(src, dest, options = {}) {
    src = path.resolve(src);
    dest = path.resolve(dest);
    if (src === dest) {
        throw new Error("Source and destination cannot be the same.");
    }
    const srcStat = await Deno.lstat(src);
    if (srcStat.isDirectory && isSubdir(src, dest)) {
        throw new Error(`Cannot copy '${src}' to a subdirectory of itself, '${dest}'.`);
    }
    if (srcStat.isSymlink) {
        await copySymLink(src, dest, options);
    }
    else if (srcStat.isDirectory) {
        await copyDir(src, dest, options);
    }
    else if (srcStat.isFile) {
        await copyFile(src, dest, options);
    }
}
export function copySync(src, dest, options = {}) {
    src = path.resolve(src);
    dest = path.resolve(dest);
    if (src === dest) {
        throw new Error("Source and destination cannot be the same.");
    }
    const srcStat = Deno.lstatSync(src);
    if (srcStat.isDirectory && isSubdir(src, dest)) {
        throw new Error(`Cannot copy '${src}' to a subdirectory of itself, '${dest}'.`);
    }
    if (srcStat.isSymlink) {
        copySymlinkSync(src, dest, options);
    }
    else if (srcStat.isDirectory) {
        copyDirSync(src, dest, options);
    }
    else if (srcStat.isFile) {
        copyFileSync(src, dest, options);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29weS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvcHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLElBQUksTUFBTSxnQkFBZ0IsQ0FBQztBQUN2QyxPQUFPLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNELE9BQU8sRUFBRSxlQUFlLEVBQUUsUUFBUSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM1QyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUF1QjNDLEtBQUssVUFBVSxlQUFlLENBQzVCLEdBQVcsRUFDWCxJQUFZLEVBQ1osT0FBNEI7SUFFNUIsSUFBSSxRQUF1QixDQUFDO0lBRTVCLElBQUk7UUFDRixRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ25DO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDWixJQUFJLEdBQUcsWUFBWSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtZQUN2QyxPQUFPO1NBQ1I7UUFDRCxNQUFNLEdBQUcsQ0FBQztLQUNYO0lBRUQsSUFBSSxPQUFPLENBQUMsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRTtRQUM3QyxNQUFNLElBQUksS0FBSyxDQUNiLG1DQUFtQyxJQUFJLHFCQUFxQixHQUFHLElBQUksQ0FDcEUsQ0FBQztLQUNIO0lBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUU7UUFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksbUJBQW1CLENBQUMsQ0FBQztLQUM5QztJQUVELE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUMxQixHQUFXLEVBQ1gsSUFBWSxFQUNaLE9BQTRCO0lBRTVCLElBQUksUUFBdUIsQ0FBQztJ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LEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQ3JDO1NBQU0sSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFO1FBQzlCLFdBQVcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQ2pDO1NBQU0sSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFO1FBQ3pCLFlBQVksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQ2xDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjEgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCIuLi9wYXRoL21vZC50c1wiO1xuaW1wb3J0IHsgZW5zdXJlRGlyLCBlbnN1cmVEaXJTeW5jIH0gZnJvbSBcIi4vZW5zdXJlX2Rpci50c1wiO1xuaW1wb3J0IHsgZ2V0RmlsZUluZm9UeXBlLCBpc1N1YmRpciB9IGZyb20gXCIuL191dGlsLnRzXCI7XG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vX3V0aWwvYXNzZXJ0LnRzXCI7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tIFwiLi4vX3V0aWwvb3MudHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBDb3B5T3B0aW9ucyB7XG4gIC8qKlxuICAgKiBvdmVyd3JpdGUgZXhpc3RpbmcgZmlsZSBvciBkaXJlY3RvcnkuIERlZmF1bHQgaXMgYGZhbHNlYFxuICAgKi9cbiAgb3ZlcndyaXRlPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIFdoZW4gYHRydWVgLCB3aWxsIHNldCBsYXN0IG1vZGlmaWNhdGlvbiBhbmQgYWNjZXNzIHRpbWVzIHRvIHRoZSBvbmVzIG9mIHRoZVxuICAgKiBvcmlnaW5hbCBzb3VyY2UgZmlsZXMuXG4gICAqIFdoZW4gYGZhbHNlYCwgdGltZXN0YW1wIGJlaGF2aW9yIGlzIE9TLWRlcGVuZGVudC5cbiAgICogRGVmYXVsdCBpcyBgZmFsc2VgLlxuICAgKi9cbiAgcHJlc2VydmVUaW1lc3RhbXBzPzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIEludGVybmFsQ29weU9wdGlvbnMgZXh0ZW5kcyBDb3B5T3B0aW9ucyB7XG4gIC8qKlxuICAgKiBkZWZhdWx0IGlzIGBmYWxzZWBcbiAgICovXG4gIGlzRm9sZGVyPzogYm9vbGVhbjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlVmFsaWRDb3B5KFxuICBzcmM6IHN0cmluZyxcbiAgZGVzdDogc3RyaW5nLFxuICBvcHRpb25zOiBJbnRlcm5hbENvcHlPcHRpb25zLFxuKTogUHJvbWlzZTxEZW5vLkZpbGVJbmZvIHwgdW5kZWZpbmVkPiB7XG4gIGxldCBkZXN0U3RhdDogRGVuby5GaWxlSW5mbztcblxuICB0cnkge1xuICAgIGRlc3RTdGF0ID0gYXdhaXQgRGVuby5sc3RhdChkZXN0KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyciBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLk5vdEZvdW5kKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIGlmIChvcHRpb25zLmlzRm9sZGVyICYmICFkZXN0U3RhdC5pc0RpcmVjdG9yeSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBDYW5ub3Qgb3ZlcndyaXRlIG5vbi1kaXJlY3RvcnkgJyR7ZGVzdH0nIHdpdGggZGlyZWN0b3J5ICcke3NyY30nLmAsXG4gICAgKTtcbiAgfVxuICBpZiAoIW9wdGlvbnMub3ZlcndyaXRlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGAnJHtkZXN0fScgYWxyZWFkeSBleGlzdHMuYCk7XG4gIH1cblxuICByZXR1cm4gZGVzdFN0YXQ7XG59XG5cbmZ1bmN0aW9uIGVuc3VyZVZhbGlkQ29weVN5bmMoXG4gIHNyYzogc3RyaW5nLFxuICBkZXN0OiBzdHJpbmcsXG4gIG9wdGlvbnM6IEludGVybmFsQ29weU9wdGlvbnMsXG4pOiBEZW5vLkZpbGVJbmZvIHwgdW5kZWZpbmVkIHtcbiAgbGV0IGRlc3RTdGF0OiBEZW5vLkZpbGVJbmZvO1xuICB0cnkge1xuICAgIGRlc3RTdGF0ID0gRGVuby5sc3RhdFN5bmMoZGVzdCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChlcnIgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5Ob3RGb3VuZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICBpZiAob3B0aW9ucy5pc0ZvbGRlciAmJiAhZGVzdFN0YXQuaXNEaXJlY3RvcnkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgQ2Fubm90IG92ZXJ3cml0ZSBub24tZGlyZWN0b3J5ICcke2Rlc3R9JyB3aXRoIGRpcmVjdG9yeSAnJHtzcmN9Jy5gLFxuICAgICk7XG4gIH1cbiAgaWYgKCFvcHRpb25zLm92ZXJ3cml0ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgJyR7ZGVzdH0nIGFscmVhZHkgZXhpc3RzLmApO1xuICB9XG5cbiAgcmV0dXJuIGRlc3RTdGF0O1xufVxuXG4vKiBjb3B5IGZpbGUgdG8gZGVzdCAqL1xuYXN5bmMgZnVuY3Rpb24gY29weUZpbGUoXG4gIHNyYzogc3RyaW5nLFxuICBkZXN0OiBzdHJpbmcsXG4gIG9wdGlvbnM6IEludGVybmFsQ29weU9wdGlvbnMsXG4pIHtcbiAgYXdhaXQgZW5zdXJlVmFsaWRDb3B5KHNyYywgZGVzdCwgb3B0aW9ucyk7XG4gIGF3YWl0IERlbm8uY29weUZpbGUoc3JjLCBkZXN0KTtcbiAgaWYgKG9wdGlvbnMucHJlc2VydmVUaW1lc3RhbXBzKSB7XG4gICAgY29uc3Qgc3RhdEluZm8gPSBhd2FpdCBEZW5vLnN0YXQoc3JjKTtcbiAgICBhc3NlcnQoc3RhdEluZm8uYXRpbWUgaW5zdGFuY2VvZiBEYXRlLCBgc3RhdEluZm8uYXRpbWUgaXMgdW5hdmFpbGFibGVgKTtcbiAgICBhc3NlcnQoc3RhdEluZm8ubXRpbWUgaW5zdGFuY2VvZiBEYXRlLCBgc3RhdEluZm8ubXRpbWUgaXMgdW5hdmFpbGFibGVgKTtcbiAgICBhd2FpdCBEZW5vLnV0aW1lKGRlc3QsIHN0YXRJbmZvLmF0aW1lLCBzdGF0SW5mby5tdGltZSk7XG4gIH1cbn1cbi8qIGNvcHkgZmlsZSB0byBkZXN0IHN5bmNocm9ub3VzbHkgKi9cbmZ1bmN0aW9uIGNvcHlGaWxlU3luYyhcbiAgc3JjOiBzdHJpbmcsXG4gIGRlc3Q6IHN0cmluZyxcbiAgb3B0aW9uczogSW50ZXJuYWxDb3B5T3B0aW9ucyxcbik6IHZvaWQge1xuICBlbnN1cmVWYWxpZENvcHlTeW5jKHNyYywgZGVzdCwgb3B0aW9ucyk7XG4gIERlbm8uY29weUZpbGVTeW5jKHNyYywgZGVzdCk7XG4gIGlmIChvcHRpb25zLnByZXNlcnZlVGltZXN0YW1wcykge1xuICAgIGNvbnN0IHN0YXRJbmZvID0gRGVuby5zdGF0U3luYyhzcmMpO1xuICAgIGFzc2VydChzdGF0SW5mby5hdGltZSBpbnN0YW5jZW9mIERhdGUsIGBzdGF0SW5mby5hdGltZSBpcyB1bmF2YWlsYWJsZWApO1xuICAgIGFzc2VydChzdGF0SW5mby5tdGltZSBpbnN0YW5jZW9mIERhdGUsIGBzdGF0SW5mby5tdGltZSBpcyB1bmF2YWlsYWJsZWApO1xuICAgIERlbm8udXRpbWVTeW5jKGRlc3QsIHN0YXRJbmZvLmF0aW1lLCBzdGF0SW5mby5tdGltZSk7XG4gIH1cbn1cblxuLyogY29weSBzeW1saW5rIHRvIGRlc3QgKi9cbmFzeW5jIGZ1bmN0aW9uIGNvcHlTeW1MaW5rKFxuICBzcmM6IHN0cmluZyxcbiAgZGVzdDogc3RyaW5nLFxuICBvcHRpb25zOiBJbnRlcm5hbENvcHlPcHRpb25zLFxuKSB7XG4gIGF3YWl0IGVuc3VyZVZhbGlkQ29weShzcmMsIGRlc3QsIG9wdGlvbnMpO1xuICBjb25zdCBvcmlnaW5TcmNGaWxlUGF0aCA9IGF3YWl0IERlbm8ucmVhZExpbmsoc3JjKTtcbiAgY29uc3QgdHlwZSA9IGdldEZpbGVJbmZvVHlwZShhd2FpdCBEZW5vLmxzdGF0KHNyYykpO1xuICBpZiAoaXNXaW5kb3dzKSB7XG4gICAgYXdhaXQgRGVuby5zeW1saW5rKG9yaWdpblNyY0ZpbGVQYXRoLCBkZXN0LCB7XG4gICAgICB0eXBlOiB0eXBlID09PSBcImRpclwiID8gXCJkaXJcIiA6IFwiZmlsZVwiLFxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGF3YWl0IERlbm8uc3ltbGluayhvcmlnaW5TcmNGaWxlUGF0aCwgZGVzdCk7XG4gIH1cbiAgaWYgKG9wdGlvbnMucHJlc2VydmVUaW1lc3RhbXBzKSB7XG4gICAgY29uc3Qgc3RhdEluZm8gPSBhd2FpdCBEZW5vLmxzdGF0KHNyYyk7XG4gICAgYXNzZXJ0KHN0YXRJbmZvLmF0aW1lIGluc3RhbmNlb2YgRGF0ZSwgYHN0YXRJbmZvLmF0aW1lIGlzIHVuYXZhaWxhYmxlYCk7XG4gICAgYXNzZXJ0KHN0YXRJbmZvLm10aW1lIGluc3RhbmNlb2YgRGF0ZSwgYHN0YXRJbmZvLm10aW1lIGlzIHVuYXZhaWxhYmxlYCk7XG4gICAgYXdhaXQgRGVuby51dGltZShkZXN0LCBzdGF0SW5mby5hdGltZSwgc3RhdEluZm8ubXRpbWUpO1xuICB9XG59XG5cbi8qIGNvcHkgc3ltbGluayB0byBkZXN0IHN5bmNocm9ub3VzbHkgKi9cbmZ1bmN0aW9uIGNvcHlTeW1saW5rU3luYyhcbiAgc3JjOiBzdHJpbmcsXG4gIGRlc3Q6IHN0cmluZyxcbiAgb3B0aW9uczogSW50ZXJuYWxDb3B5T3B0aW9ucyxcbik6IHZvaWQge1xuICBlbnN1cmVWYWxpZENvcHlTeW5jKHNyYywgZGVzdCwgb3B0aW9ucyk7XG4gIGNvbnN0IG9yaWdpblNyY0ZpbGVQYXRoID0gRGVuby5yZWFkTGlua1N5bmMoc3JjKTtcbiAgY29uc3QgdHlwZSA9IGdldEZpbGVJbmZvVHlwZShEZW5vLmxzdGF0U3luYyhzcmMpKTtcbiAgaWYgKGlzV2luZG93cykge1xuICAgIERlbm8uc3ltbGlua1N5bmMob3JpZ2luU3JjRmlsZVBhdGgsIGRlc3QsIHtcbiAgICAgIHR5cGU6IHR5cGUgPT09IFwiZGlyXCIgPyBcImRpclwiIDogXCJmaWxlXCIsXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgRGVuby5zeW1saW5rU3luYyhvcmlnaW5TcmNGaWxlUGF0aCwgZGVzdCk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5wcmVzZXJ2ZVRpbWVzdGFtcHMpIHtcbiAgICBjb25zdCBzdGF0SW5mbyA9IERlbm8ubHN0YXRTeW5jKHNyYyk7XG4gICAgYXNzZXJ0KHN0YXRJbmZvLmF0aW1lIGluc3RhbmNlb2YgRGF0ZSwgYHN0YXRJbmZvLmF0aW1lIGlzIHVuYXZhaWxhYmxlYCk7XG4gICAgYXNzZXJ0KHN0YXRJbmZvLm10aW1lIGluc3RhbmNlb2YgRGF0ZSwgYHN0YXRJbmZvLm10aW1lIGlzIHVuYXZhaWxhYmxlYCk7XG4gICAgRGVuby51dGltZVN5bmMoZGVzdCwgc3RhdEluZm8uYXRpbWUsIHN0YXRJbmZvLm10aW1lKTtcbiAgfVxufVxuXG4vKiBjb3B5IGZvbGRlciBmcm9tIHNyYyB0byBkZXN0LiAqL1xuYXN5bmMgZnVuY3Rpb24gY29weURpcihcbiAgc3JjOiBzdHJpbmcsXG4gIGRlc3Q6IHN0cmluZyxcbiAgb3B0aW9uczogQ29weU9wdGlvbnMsXG4pIHtcbiAgY29uc3QgZGVzdFN0YXQgPSBhd2FpdCBlbnN1cmVWYWxpZENvcHkoc3JjLCBkZXN0LCB7XG4gICAgLi4ub3B0aW9ucyxcbiAgICBpc0ZvbGRlcjogdHJ1ZSxcbiAgfSk7XG5cbiAgaWYgKCFkZXN0U3RhdCkge1xuICAgIGF3YWl0IGVuc3VyZURpcihkZXN0KTtcbiAgfVxuXG4gIGlmIChvcHRpb25zLnByZXNlcnZlVGltZXN0YW1wcykge1xuICAgIGNvbnN0IHNyY1N0YXRJbmZvID0gYXdhaXQgRGVuby5zdGF0KHNyYyk7XG4gICAgYXNzZXJ0KHNyY1N0YXRJbmZvLmF0aW1lIGluc3RhbmNlb2YgRGF0ZSwgYHN0YXRJbmZvLmF0aW1lIGlzIHVuYXZhaWxhYmxlYCk7XG4gICAgYXNzZXJ0KHNyY1N0YXRJbmZvLm10aW1lIGluc3RhbmNlb2YgRGF0ZSwgYHN0YXRJbmZvLm10aW1lIGlzIHVuYXZhaWxhYmxlYCk7XG4gICAgYXdhaXQgRGVuby51dGltZShkZXN0LCBzcmNTdGF0SW5mby5hdGltZSwgc3JjU3RhdEluZm8ubXRpbWUpO1xuICB9XG5cbiAgZm9yIGF3YWl0IChjb25zdCBlbnRyeSBvZiBEZW5vLnJlYWREaXIoc3JjKSkge1xuICAgIGNvbnN0IHNyY1BhdGggPSBwYXRoLmpvaW4oc3JjLCBlbnRyeS5uYW1lKTtcbiAgICBjb25zdCBkZXN0UGF0aCA9IHBhdGguam9pbihkZXN0LCBwYXRoLmJhc2VuYW1lKHNyY1BhdGggYXMgc3RyaW5nKSk7XG4gICAgaWYgKGVudHJ5LmlzU3ltbGluaykge1xuICAgICAgYXdhaXQgY29weVN5bUxpbmsoc3JjUGF0aCwgZGVzdFBhdGgsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAoZW50cnkuaXNEaXJlY3RvcnkpIHtcbiAgICAgIGF3YWl0IGNvcHlEaXIoc3JjUGF0aCwgZGVzdFBhdGgsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAoZW50cnkuaXNGaWxlKSB7XG4gICAgICBhd2FpdCBjb3B5RmlsZShzcmNQYXRoLCBkZXN0UGF0aCwgb3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbi8qIGNvcHkgZm9sZGVyIGZyb20gc3JjIHRvIGRlc3Qgc3luY2hyb25vdXNseSAqL1xuZnVuY3Rpb24gY29weURpclN5bmMoc3JjOiBzdHJpbmcsIGRlc3Q6IHN0cmluZywgb3B0aW9uczogQ29weU9wdGlvbnMpOiB2b2lkIHtcbiAgY29uc3QgZGVzdFN0YXQgPSBlbnN1cmVWYWxpZENvcHlTeW5jKHNyYywgZGVzdCwge1xuICAgIC4uLm9wdGlvbnMsXG4gICAgaXNGb2xkZXI6IHRydWUsXG4gIH0pO1xuXG4gIGlmICghZGVzdFN0YXQpIHtcbiAgICBlbnN1cmVEaXJTeW5jKGRlc3QpO1xuICB9XG5cbiAgaWYgKG9wdGlvbnMucHJlc2VydmVUaW1lc3RhbXBzKSB7XG4gICAgY29uc3Qgc3JjU3RhdEluZm8gPSBEZW5vLnN0YXRTeW5jKHNyYyk7XG4gICAgYXNzZXJ0KHNyY1N0YXRJbmZvLmF0aW1lIGluc3RhbmNlb2YgRGF0ZSwgYHN0YXRJbmZvLmF0aW1lIGlzIHVuYXZhaWxhYmxlYCk7XG4gICAgYXNzZXJ0KHNyY1N0YXRJbmZvLm10aW1lIGluc3RhbmNlb2YgRGF0ZSwgYHN0YXRJbmZvLm10aW1lIGlzIHVuYXZhaWxhYmxlYCk7XG4gICAgRGVuby51dGltZVN5bmMoZGVzdCwgc3JjU3RhdEluZm8uYXRpbWUsIHNyY1N0YXRJbmZvLm10aW1lKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgZW50cnkgb2YgRGVuby5yZWFkRGlyU3luYyhzcmMpKSB7XG4gICAgYXNzZXJ0KGVudHJ5Lm5hbWUgIT0gbnVsbCwgXCJmaWxlLm5hbWUgbXVzdCBiZSBzZXRcIik7XG4gICAgY29uc3Qgc3JjUGF0aCA9IHBhdGguam9pbihzcmMsIGVudHJ5Lm5hbWUpO1xuICAgIGNvbnN0IGRlc3RQYXRoID0gcGF0aC5qb2luKGRlc3QsIHBhdGguYmFzZW5hbWUoc3JjUGF0aCBhcyBzdHJpbmcpKTtcbiAgICBpZiAoZW50cnkuaXNTeW1saW5rKSB7XG4gICAgICBjb3B5U3ltbGlua1N5bmMoc3JjUGF0aCwgZGVzdFBhdGgsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAoZW50cnkuaXNEaXJlY3RvcnkpIHtcbiAgICAgIGNvcHlEaXJTeW5jKHNyY1BhdGgsIGRlc3RQYXRoLCBvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKGVudHJ5LmlzRmlsZSkge1xuICAgICAgY29weUZpbGVTeW5jKHNyY1BhdGgsIGRlc3RQYXRoLCBvcHRpb25zKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDb3B5IGEgZmlsZSBvciBkaXJlY3RvcnkuIFRoZSBkaXJlY3RvcnkgY2FuIGhhdmUgY29udGVudHMuIExpa2UgYGNwIC1yYC5cbiAqIFJlcXVpcmVzIHRoZSBgLS1hbGxvdy1yZWFkYCBhbmQgYC0tYWxsb3ctd3JpdGVgIGZsYWcuXG4gKiBAcGFyYW0gc3JjIHRoZSBmaWxlL2RpcmVjdG9yeSBwYXRoLlxuICogICAgICAgICAgICBOb3RlIHRoYXQgaWYgYHNyY2AgaXMgYSBkaXJlY3RvcnkgaXQgd2lsbCBjb3B5IGV2ZXJ5dGhpbmcgaW5zaWRlXG4gKiAgICAgICAgICAgIG9mIHRoaXMgZGlyZWN0b3J5LCBub3QgdGhlIGVudGlyZSBkaXJlY3RvcnkgaXRzZWxmXG4gKiBAcGFyYW0gZGVzdCB0aGUgZGVzdGluYXRpb24gcGF0aC4gTm90ZSB0aGF0IGlmIGBzcmNgIGlzIGEgZmlsZSwgYGRlc3RgIGNhbm5vdFxuICogICAgICAgICAgICAgYmUgYSBkaXJlY3RvcnlcbiAqIEBwYXJhbSBvcHRpb25zXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb3B5KFxuICBzcmM6IHN0cmluZyxcbiAgZGVzdDogc3RyaW5nLFxuICBvcHRpb25zOiBDb3B5T3B0aW9ucyA9IHt9LFxuKSB7XG4gIHNyYyA9IHBhdGgucmVzb2x2ZShzcmMpO1xuICBkZXN0ID0gcGF0aC5yZXNvbHZlKGRlc3QpO1xuXG4gIGlmIChzcmMgPT09IGRlc3QpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJTb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGNhbm5vdCBiZSB0aGUgc2FtZS5cIik7XG4gIH1cblxuICBjb25zdCBzcmNTdGF0ID0gYXdhaXQgRGVuby5sc3RhdChzcmMpO1xuXG4gIGlmIChzcmNTdGF0LmlzRGlyZWN0b3J5ICYmIGlzU3ViZGlyKHNyYywgZGVzdCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgQ2Fubm90IGNvcHkgJyR7c3JjfScgdG8gYSBzdWJkaXJlY3Rvcnkgb2YgaXRzZWxmLCAnJHtkZXN0fScuYCxcbiAgICApO1xuICB9XG5cbiAgaWYgKHNyY1N0YXQuaXNTeW1saW5rKSB7XG4gICAgYXdhaXQgY29weVN5bUxpbmsoc3JjLCBkZXN0LCBvcHRpb25zKTtcbiAgfSBlbHNlIGlmIChzcmNTdGF0LmlzRGlyZWN0b3J5KSB7XG4gICAgYXdhaXQgY29weURpcihzcmMsIGRlc3QsIG9wdGlvbnMpO1xuICB9IGVsc2UgaWYgKHNyY1N0YXQuaXNGaWxlKSB7XG4gICAgYXdhaXQgY29weUZpbGUoc3JjLCBkZXN0LCBvcHRpb25zKTtcbiAgfVxufVxuXG4vKipcbiAqIENvcHkgYSBmaWxlIG9yIGRpcmVjdG9yeS4gVGhlIGRpcmVjdG9yeSBjYW4gaGF2ZSBjb250ZW50cy4gTGlrZSBgY3AgLXJgLlxuICogUmVxdWlyZXMgdGhlIGAtLWFsbG93LXJlYWRgIGFuZCBgLS1hbGxvdy13cml0ZWAgZmxhZy5cbiAqIEBwYXJhbSBzcmMgdGhlIGZpbGUvZGlyZWN0b3J5IHBhdGguXG4gKiAgICAgICAgICAgIE5vdGUgdGhhdCBpZiBgc3JjYCBpcyBhIGRpcmVjdG9yeSBpdCB3aWxsIGNvcHkgZXZlcnl0aGluZyBpbnNpZGVcbiAqICAgICAgICAgICAgb2YgdGhpcyBkaXJlY3RvcnksIG5vdCB0aGUgZW50aXJlIGRpcmVjdG9yeSBpdHNlbGZcbiAqIEBwYXJhbSBkZXN0IHRoZSBkZXN0aW5hdGlvbiBwYXRoLiBOb3RlIHRoYXQgaWYgYHNyY2AgaXMgYSBmaWxlLCBgZGVzdGAgY2Fubm90XG4gKiAgICAgICAgICAgICBiZSBhIGRpcmVjdG9yeVxuICogQHBhcmFtIG9wdGlvbnNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvcHlTeW5jKFxuICBzcmM6IHN0cmluZyxcbiAgZGVzdDogc3RyaW5nLFxuICBvcHRpb25zOiBDb3B5T3B0aW9ucyA9IHt9LFxuKTogdm9pZCB7XG4gIHNyYyA9IHBhdGgucmVzb2x2ZShzcmMpO1xuICBkZXN0ID0gcGF0aC5yZXNvbHZlKGRlc3QpO1xuXG4gIGlmIChzcmMgPT09IGRlc3QpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJTb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGNhbm5vdCBiZSB0aGUgc2FtZS5cIik7XG4gIH1cblxuICBjb25zdCBzcmNTdGF0ID0gRGVuby5sc3RhdFN5bmMoc3JjKTtcblxuICBpZiAoc3JjU3RhdC5pc0RpcmVjdG9yeSAmJiBpc1N1YmRpcihzcmMsIGRlc3QpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYENhbm5vdCBjb3B5ICcke3NyY30nIHRvIGEgc3ViZGlyZWN0b3J5IG9mIGl0c2VsZiwgJyR7ZGVzdH0nLmAsXG4gICAgKTtcbiAgfVxuXG4gIGlmIChzcmNTdGF0LmlzU3ltbGluaykge1xuICAgIGNvcHlTeW1saW5rU3luYyhzcmMsIGRlc3QsIG9wdGlvbnMpO1xuICB9IGVsc2UgaWYgKHNyY1N0YXQuaXNEaXJlY3RvcnkpIHtcbiAgICBjb3B5RGlyU3luYyhzcmMsIGRlc3QsIG9wdGlvbnMpO1xuICB9IGVsc2UgaWYgKHNyY1N0YXQuaXNGaWxlKSB7XG4gICAgY29weUZpbGVTeW5jKHNyYywgZGVzdCwgb3B0aW9ucyk7XG4gIH1cbn1cbiJdfQ==