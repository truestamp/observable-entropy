// Copyright since 2020, FranckLdx. All rights reserved. MIT license.
import { denoDelay } from "../deps.ts";
import { assertDefined, asyncDecorator } from "../misc.ts";
import { getDefaultRetryOptions } from "./options.ts";
import { isTooManyTries, TooManyTries } from "./tooManyTries.ts";
/** 
 * Retry a function until it does not throw an exception.
 *  
 * @param fn the function to execute
 * @param retryOptions retry options
 */ export function retry(fn, retryOptions) {
    const fnAsync = asyncDecorator(fn);
    return retryAsync(fnAsync, retryOptions);
}
/** 
 * Retry an async function until it does not throw an exception.
 *  
 * @param fn the async function to execute
 * @param retryOptions retry options
 */ export async function retryAsync(fn, retryOptions) {
    const { maxTry , delay , until  } = {
        ...getDefaultRetryOptions(),
        ...retryOptions
    };
    assertDefined(maxTry, `maxTry must be defined`);
    assertDefined(delay, `delay must be defined`);
    const canRecall = ()=>maxTry > 1;
    const recall = async ()=>{
        await denoDelay(delay);
        return await retryAsync(fn, {
            delay,
            maxTry: maxTry - 1,
            until
        });
    };
    try {
        const result = await fn();
        const done = until ? until(result) : true;
        if (done) {
            return result;
        } else if (canRecall()) {
            return await recall();
        } else {
            throw new TooManyTries();
        }
    } catch (err) {
        if (!isTooManyTries(err) && canRecall()) {
            return await recall();
        } else {
            throw err;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvcmV0cnlAdjIuMC4wL3JldHJ5L3JldHJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCBzaW5jZSAyMDIwLCBGcmFuY2tMZHguIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgZGVub0RlbGF5IH0gZnJvbSBcIi4uL2RlcHMudHNcIjtcbmltcG9ydCB7IGFzc2VydERlZmluZWQsIGFzeW5jRGVjb3JhdG9yIH0gZnJvbSBcIi4uL21pc2MudHNcIjtcbmltcG9ydCB7XG4gIGRlZmF1bHRSZXRyeU9wdGlvbnMsXG4gIGdldERlZmF1bHRSZXRyeU9wdGlvbnMsXG4gIFJldHJ5T3B0aW9ucyxcbn0gZnJvbSBcIi4vb3B0aW9ucy50c1wiO1xuaW1wb3J0IHsgaXNUb29NYW55VHJpZXMsIFRvb01hbnlUcmllcyB9IGZyb20gXCIuL3Rvb01hbnlUcmllcy50c1wiO1xuXG4vKiogXG4gKiBSZXRyeSBhIGZ1bmN0aW9uIHVudGlsIGl0IGRvZXMgbm90IHRocm93IGFuIGV4Y2VwdGlvbi5cbiAqICBcbiAqIEBwYXJhbSBmbiB0aGUgZnVuY3Rpb24gdG8gZXhlY3V0ZVxuICogQHBhcmFtIHJldHJ5T3B0aW9ucyByZXRyeSBvcHRpb25zXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXRyeTxSRVRVUk5fVFlQRT4oXG4gIGZuOiAoKSA9PiBSRVRVUk5fVFlQRSxcbiAgcmV0cnlPcHRpb25zPzogUmV0cnlPcHRpb25zPFJFVFVSTl9UWVBFPixcbik6IFByb21pc2U8UkVUVVJOX1RZUEU+IHtcbiAgY29uc3QgZm5Bc3luYyA9IGFzeW5jRGVjb3JhdG9yKGZuKTtcbiAgcmV0dXJuIHJldHJ5QXN5bmMoZm5Bc3luYywgcmV0cnlPcHRpb25zKTtcbn1cblxuLyoqIFxuICogUmV0cnkgYW4gYXN5bmMgZnVuY3Rpb24gdW50aWwgaXQgZG9lcyBub3QgdGhyb3cgYW4gZXhjZXB0aW9uLlxuICogIFxuICogQHBhcmFtIGZuIHRoZSBhc3luYyBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcGFyYW0gcmV0cnlPcHRpb25zIHJldHJ5IG9wdGlvbnNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJldHJ5QXN5bmM8VD4oXG4gIGZuOiAoKSA9PiBQcm9taXNlPFQ+LFxuICByZXRyeU9wdGlvbnM/OiBSZXRyeU9wdGlvbnM8VD4sXG4pOiBQcm9taXNlPFQ+IHtcbiAgY29uc3QgeyBtYXhUcnksIGRlbGF5LCB1bnRpbCB9ID0ge1xuICAgIC4uLmdldERlZmF1bHRSZXRyeU9wdGlvbnMoKSxcbiAgICAuLi5yZXRyeU9wdGlvbnMsXG4gIH07XG4gIGFzc2VydERlZmluZWQobWF4VHJ5LCBgbWF4VHJ5IG11c3QgYmUgZGVmaW5lZGApO1xuICBhc3NlcnREZWZpbmVkKGRlbGF5LCBgZGVsYXkgbXVzdCBiZSBkZWZpbmVkYCk7XG4gIGNvbnN0IGNhblJlY2FsbCA9ICgpID0+IG1heFRyeSEgPiAxO1xuICBjb25zdCByZWNhbGwgPSBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZGVub0RlbGF5KGRlbGF5ISk7XG4gICAgcmV0dXJuIGF3YWl0IHJldHJ5QXN5bmMoZm4sIHsgZGVsYXksIG1heFRyeTogbWF4VHJ5ISAtIDEsIHVudGlsIH0pO1xuICB9O1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZuKCk7XG4gICAgY29uc3QgZG9uZSA9IHVudGlsID8gdW50aWwocmVzdWx0KSA6IHRydWU7XG4gICAgaWYgKGRvbmUpIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIGlmIChjYW5SZWNhbGwoKSkge1xuICAgICAgcmV0dXJuIGF3YWl0IHJlY2FsbCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgVG9vTWFueVRyaWVzKCk7XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoIWlzVG9vTWFueVRyaWVzKGVycikgJiYgY2FuUmVjYWxsKCkpIHtcbiAgICAgIHJldHVybiBhd2FpdCByZWNhbGwoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHFFQUFxRTtBQUNyRSxTQUFTLFNBQVMsUUFBUSxZQUFZLENBQUM7QUFDdkMsU0FBUyxhQUFhLEVBQUUsY0FBYyxRQUFRLFlBQVksQ0FBQztBQUMzRCxTQUVFLHNCQUFzQixRQUVqQixjQUFjLENBQUM7QUFDdEIsU0FBUyxjQUFjLEVBQUUsWUFBWSxRQUFRLG1CQUFtQixDQUFDO0FBRWpFOzs7OztHQUtHLENBQ0gsT0FBTyxTQUFTLEtBQUssQ0FDbkIsRUFBcUIsRUFDckIsWUFBd0MsRUFDbEI7SUFDdEIsTUFBTSxPQUFPLEdBQUcsY0FBYyxDQUFDLEVBQUUsQ0FBQyxBQUFDO0lBQ25DLE9BQU8sVUFBVSxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQztDQUMxQztBQUVEOzs7OztHQUtHLENBQ0gsT0FBTyxlQUFlLFVBQVUsQ0FDOUIsRUFBb0IsRUFDcEIsWUFBOEIsRUFDbEI7SUFDWixNQUFNLEVBQUUsTUFBTSxDQUFBLEVBQUUsS0FBSyxDQUFBLEVBQUUsS0FBSyxDQUFBLEVBQUUsR0FBRztRQUMvQixHQUFHLHNCQUFzQixFQUFFO1FBQzNCLEdBQUcsWUFBWTtLQUNoQixBQUFDO0lBQ0YsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQztJQUNoRCxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0lBQzlDLE1BQU0sU0FBUyxHQUFHLElBQU0sTUFBTSxHQUFJLENBQUMsQUFBQztJQUNwQyxNQUFNLE1BQU0sR0FBRyxVQUFZO1FBQ3pCLE1BQU0sU0FBUyxDQUFDLEtBQUssQ0FBRSxDQUFDO1FBQ3hCLE9BQU8sTUFBTSxVQUFVLENBQUMsRUFBRSxFQUFFO1lBQUUsS0FBSztZQUFFLE1BQU0sRUFBRSxNQUFNLEdBQUksQ0FBQztZQUFFLEtBQUs7U0FBRSxDQUFDLENBQUM7S0FDcEUsQUFBQztJQUNGLElBQUk7UUFDRixNQUFNLE1BQU0sR0FBRyxNQUFNLEVBQUUsRUFBRSxBQUFDO1FBQzFCLE1BQU0sSUFBSSxHQUFHLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxBQUFDO1FBQzFDLElBQUksSUFBSSxFQUFFO1lBQ1IsT0FBTyxNQUFNLENBQUM7U0FDZixNQUFNLElBQUksU0FBUyxFQUFFLEVBQUU7WUFDdEIsT0FBTyxNQUFNLE1BQU0sRUFBRSxDQUFDO1NBQ3ZCLE1BQU07WUFDTCxNQUFNLElBQUksWUFBWSxFQUFFLENBQUM7U0FDMUI7S0FDRixDQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1osSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLEVBQUUsRUFBRTtZQUN2QyxPQUFPLE1BQU0sTUFBTSxFQUFFLENBQUM7U0FDdkIsTUFBTTtZQUNMLE1BQU0sR0FBRyxDQUFDO1NBQ1g7S0FDRjtDQUNGIn0=