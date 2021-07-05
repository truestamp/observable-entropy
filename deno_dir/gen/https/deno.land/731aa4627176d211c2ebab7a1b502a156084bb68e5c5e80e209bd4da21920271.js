import { denoDelay } from "../deps.ts";
import { asyncDecorator } from "../misc.ts";
import { defaultDuration } from "./options.ts";
import { TimeoutError } from "./timeoutError.ts";
export async function waitUntilAsync(fn, duration = defaultDuration, error = new TimeoutError("function did not complete within allowed time")) {
    const canary = Symbol("RETRY_LIB_FN_EXPIRED");
    const result = await Promise.race([
        fn(),
        denoDelay(duration).then(() => canary),
    ]);
    if (result === canary) {
        throw error;
    }
    return result;
}
export async function waitUntil(fn, duration, error) {
    const fnAsync = asyncDecorator(fn);
    return await waitUntilAsync(fnAsync, duration, error);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FpdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIndhaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUN2QyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzVDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDL0MsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBU2pELE1BQU0sQ0FBQyxLQUFLLFVBQVUsY0FBYyxDQUNsQyxFQUE4QixFQUM5QixXQUFtQixlQUFlLEVBQ2xDLFFBQWUsSUFBSSxZQUFZLENBQzdCLCtDQUErQyxDQUNoRDtJQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQzlDLE1BQU0sTUFBTSxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQztRQUNoQyxFQUFFLEVBQUU7UUFDSixTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQztLQUN2QyxDQUFDLENBQUM7SUFDSCxJQUFJLE1BQU0sS0FBSyxNQUFNLEVBQUU7UUFDckIsTUFBTSxLQUFLLENBQUM7S0FDYjtJQUNELE9BQU8sTUFBcUIsQ0FBQztBQUMvQixDQUFDO0FBU0QsTUFBTSxDQUFDLEtBQUssVUFBVSxTQUFTLENBQzdCLEVBQVcsRUFDWCxRQUFpQixFQUNqQixLQUFhO0lBRWIsTUFBTSxPQUFPLEdBQUcsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ25DLE9BQU8sTUFBTSxjQUFjLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN4RCxDQUFDIn0=