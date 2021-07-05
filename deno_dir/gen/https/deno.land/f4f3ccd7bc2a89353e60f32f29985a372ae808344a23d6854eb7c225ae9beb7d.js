import * as path from "../path/mod.ts";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";
import { exists, existsSync } from "./exists.ts";
import { getFileInfoType } from "./_util.ts";
import { isWindows } from "../_util/os.ts";
export async function ensureSymlink(src, dest) {
    const srcStatInfo = await Deno.lstat(src);
    const srcFilePathType = getFileInfoType(srcStatInfo);
    if (await exists(dest)) {
        const destStatInfo = await Deno.lstat(dest);
        const destFilePathType = getFileInfoType(destStatInfo);
        if (destFilePathType !== "symlink") {
            throw new Error(`Ensure path exists, expected 'symlink', got '${destFilePathType}'`);
        }
        return;
    }
    await ensureDir(path.dirname(dest));
    const options = isWindows
        ? {
            type: srcFilePathType === "dir" ? "dir" : "file",
        }
        : undefined;
    await Deno.symlink(src, dest, options);
}
export function ensureSymlinkSync(src, dest) {
    const srcStatInfo = Deno.lstatSync(src);
    const srcFilePathType = getFileInfoType(srcStatInfo);
    if (existsSync(dest)) {
        const destStatInfo = Deno.lstatSync(dest);
        const destFilePathType = getFileInfoType(destStatInfo);
        if (destFilePathType !== "symlink") {
            throw new Error(`Ensure path exists, expected 'symlink', got '${destFilePathType}'`);
        }
        return;
    }
    ensureDirSync(path.dirname(dest));
    const options = isWindows
        ? {
            type: srcFilePathType === "dir" ? "dir" : "file",
        }
        : undefined;
    Deno.symlinkSync(src, dest, options);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5zdXJlX3N5bWxpbmsuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlbnN1cmVfc3ltbGluay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEtBQUssSUFBSSxNQUFNLGdCQUFnQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0QsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDakQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUM3QyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFTM0MsTUFBTSxDQUFDLEtBQUssVUFBVSxhQUFhLENBQUMsR0FBVyxFQUFFLElBQVk7SUFDM0QsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzFDLE1BQU0sZUFBZSxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUVyRCxJQUFJLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3RCLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1QyxNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN2RCxJQUFJLGdCQUFnQixLQUFLLFNBQVMsRUFBRTtZQUNsQyxNQUFNLElBQUksS0FBSyxDQUNiLGdEQUFnRCxnQkFBZ0IsR0FBRyxDQUNwRSxDQUFDO1NBQ0g7UUFDRCxPQUFPO0tBQ1I7SUFFRCxNQUFNLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFFcEMsTUFBTSxPQUFPLEdBQW9DLFNBQVM7UUFDeEQsQ0FBQyxDQUFDO1lBQ0EsSUFBSSxFQUFFLGVBQWUsS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTTtTQUNqRDtRQUNELENBQUMsQ0FBQyxTQUFTLENBQUM7SUFFZCxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztBQUN6QyxDQUFDO0FBU0QsTUFBTSxVQUFVLGlCQUFpQixDQUFDLEdBQVcsRUFBRSxJQUFZO0lBQ3pELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEMsTUFBTSxlQUFlLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBRXJELElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3BCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDMUMsTUFBTSxnQkFBZ0IsR0FBRyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDdkQsSUFBSSxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7WUFDbEMsTUFBTSxJQUFJLEtBQUssQ0FDYixnREFBZ0QsZ0JBQWdCLEdBQUcsQ0FDcEUsQ0FBQztTQUNIO1FBQ0QsT0FBTztLQUNSO0lBRUQsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUVsQyxNQUFNLE9BQU8sR0FBb0MsU0FBUztRQUN4RCxDQUFDLENBQUM7WUFDQSxJQUFJLEVBQUUsZUFBZSxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNO1NBQ2pEO1FBQ0QsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUVkLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztBQUN2QyxDQUFDIn0=