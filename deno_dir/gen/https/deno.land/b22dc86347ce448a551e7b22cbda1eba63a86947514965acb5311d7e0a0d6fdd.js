import { getFileInfoType } from "./_util.ts";
export async function ensureDir(dir) {
    try {
        const fileInfo = await Deno.lstat(dir);
        if (!fileInfo.isDirectory) {
            throw new Error(`Ensure path exists, expected 'dir', got '${getFileInfoType(fileInfo)}'`);
        }
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            await Deno.mkdir(dir, { recursive: true });
            return;
        }
        throw err;
    }
}
export function ensureDirSync(dir) {
    try {
        const fileInfo = Deno.lstatSync(dir);
        if (!fileInfo.isDirectory) {
            throw new Error(`Ensure path exists, expected 'dir', got '${getFileInfoType(fileInfo)}'`);
        }
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            Deno.mkdirSync(dir, { recursive: true });
            return;
        }
        throw err;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5zdXJlX2Rpci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImVuc3VyZV9kaXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLFlBQVksQ0FBQztBQU83QyxNQUFNLENBQUMsS0FBSyxVQUFVLFNBQVMsQ0FBQyxHQUFXO0lBQ3pDLElBQUk7UUFDRixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUU7WUFDekIsTUFBTSxJQUFJLEtBQUssQ0FDYiw0Q0FDRSxlQUFlLENBQUMsUUFBUSxDQUMxQixHQUFHLENBQ0osQ0FBQztTQUNIO0tBQ0Y7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNaLElBQUksR0FBRyxZQUFZLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFO1lBRXZDLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUMzQyxPQUFPO1NBQ1I7UUFDRCxNQUFNLEdBQUcsQ0FBQztLQUNYO0FBQ0gsQ0FBQztBQU9ELE1BQU0sVUFBVSxhQUFhLENBQUMsR0FBVztJQUN2QyxJQUFJO1FBQ0YsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRTtZQUN6QixNQUFNLElBQUksS0FBSyxDQUNiLDRDQUNFLGVBQWUsQ0FBQyxRQUFRLENBQzFCLEdBQUcsQ0FDSixDQUFDO1NBQ0g7S0FDRjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1osSUFBSSxHQUFHLFlBQVksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7WUFFdkMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUN6QyxPQUFPO1NBQ1I7UUFDRCxNQUFNLEdBQUcsQ0FBQztLQUNYO0FBQ0gsQ0FBQyJ9