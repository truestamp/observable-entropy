import * as path from "../path/mod.ts";
import { ensureDir, ensureDirSync } from "./ensure_dir.ts";
import { exists, existsSync } from "./exists.ts";
import { getFileInfoType } from "./_util.ts";
export async function ensureLink(src, dest) {
    if (await exists(dest)) {
        const destStatInfo = await Deno.lstat(dest);
        const destFilePathType = getFileInfoType(destStatInfo);
        if (destFilePathType !== "file") {
            throw new Error(`Ensure path exists, expected 'file', got '${destFilePathType}'`);
        }
        return;
    }
    await ensureDir(path.dirname(dest));
    await Deno.link(src, dest);
}
export function ensureLinkSync(src, dest) {
    if (existsSync(dest)) {
        const destStatInfo = Deno.lstatSync(dest);
        const destFilePathType = getFileInfoType(destStatInfo);
        if (destFilePathType !== "file") {
            throw new Error(`Ensure path exists, expected 'file', got '${destFilePathType}'`);
        }
        return;
    }
    ensureDirSync(path.dirname(dest));
    Deno.linkSync(src, dest);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5zdXJlX2xpbmsuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlbnN1cmVfbGluay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEtBQUssSUFBSSxNQUFNLGdCQUFnQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0QsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDakQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLFlBQVksQ0FBQztBQVM3QyxNQUFNLENBQUMsS0FBSyxVQUFVLFVBQVUsQ0FBQyxHQUFXLEVBQUUsSUFBWTtJQUN4RCxJQUFJLE1BQU0sTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3RCLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1QyxNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN2RCxJQUFJLGdCQUFnQixLQUFLLE1BQU0sRUFBRTtZQUMvQixNQUFNLElBQUksS0FBSyxDQUNiLDZDQUE2QyxnQkFBZ0IsR0FBRyxDQUNqRSxDQUFDO1NBQ0g7UUFDRCxPQUFPO0tBQ1I7SUFFRCxNQUFNLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFFcEMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM3QixDQUFDO0FBU0QsTUFBTSxVQUFVLGNBQWMsQ0FBQyxHQUFXLEVBQUUsSUFBWTtJQUN0RCxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNwQixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFDLE1BQU0sZ0JBQWdCLEdBQUcsZUFBZSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3ZELElBQUksZ0JBQWdCLEtBQUssTUFBTSxFQUFFO1lBQy9CLE1BQU0sSUFBSSxLQUFLLENBQ2IsNkNBQTZDLGdCQUFnQixHQUFHLENBQ2pFLENBQUM7U0FDSDtRQUNELE9BQU87S0FDUjtJQUVELGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFFbEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDM0IsQ0FBQyJ9