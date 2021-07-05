import { denoDelay } from "../deps.ts";
import { assertDefined, asyncDecorator } from "../misc.ts";
import { getDefaultRetryOptions, } from "./options.ts";
import { isTooManyTries, TooManyTries } from "./tooManyTries.ts";
export function retry(fn, retryOptions) {
    const fnAsync = asyncDecorator(fn);
    return retryAsync(fnAsync, retryOptions);
}
export async function retryAsync(fn, retryOptions) {
    const { maxTry, delay, until } = {
        ...getDefaultRetryOptions(),
        ...retryOptions,
    };
    assertDefined(maxTry, `maxTry must be defined`);
    assertDefined(delay, `delay must be defined`);
    const canRecall = () => maxTry > 1;
    const recall = async () => {
        await denoDelay(delay);
        return await retryAsync(fn, { delay, maxTry: maxTry - 1, until });
    };
    try {
        const result = await fn();
        const done = until ? until(result) : true;
        if (done) {
            return result;
        }
        else if (canRecall()) {
            return await recall();
        }
        else {
            throw new TooManyTries();
        }
    }
    catch (err) {
        if (!isTooManyTries(err) && canRecall()) {
            return await recall();
        }
        else {
            throw err;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV0cnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZXRyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzNELE9BQU8sRUFFTCxzQkFBc0IsR0FFdkIsTUFBTSxjQUFjLENBQUM7QUFDdEIsT0FBTyxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQVFqRSxNQUFNLFVBQVUsS0FBSyxDQUNuQixFQUFxQixFQUNyQixZQUF3QztJQUV4QyxNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbkMsT0FBTyxVQUFVLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO0FBQzNDLENBQUM7QUFRRCxNQUFNLENBQUMsS0FBSyxVQUFVLFVBQVUsQ0FDOUIsRUFBb0IsRUFDcEIsWUFBOEI7SUFFOUIsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUc7UUFDL0IsR0FBRyxzQkFBc0IsRUFBRTtRQUMzQixHQUFHLFlBQVk7S0FDaEIsQ0FBQztJQUNGLGFBQWEsQ0FBQyxNQUFNLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztJQUNoRCxhQUFhLENBQUMsS0FBSyxFQUFFLHVCQUF1QixDQUFDLENBQUM7SUFDOUMsTUFBTSxTQUFTLEdBQUcsR0FBRyxFQUFFLENBQUMsTUFBTyxHQUFHLENBQUMsQ0FBQztJQUNwQyxNQUFNLE1BQU0sR0FBRyxLQUFLLElBQUksRUFBRTtRQUN4QixNQUFNLFNBQVMsQ0FBQyxLQUFNLENBQUMsQ0FBQztRQUN4QixPQUFPLE1BQU0sVUFBVSxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTyxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3JFLENBQUMsQ0FBQztJQUNGLElBQUk7UUFDRixNQUFNLE1BQU0sR0FBRyxNQUFNLEVBQUUsRUFBRSxDQUFDO1FBQzFCLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDMUMsSUFBSSxJQUFJLEVBQUU7WUFDUixPQUFPLE1BQU0sQ0FBQztTQUNmO2FBQU0sSUFBSSxTQUFTLEVBQUUsRUFBRTtZQUN0QixPQUFPLE1BQU0sTUFBTSxFQUFFLENBQUM7U0FDdkI7YUFBTTtZQUNMLE1BQU0sSUFBSSxZQUFZLEVBQUUsQ0FBQztTQUMxQjtLQUNGO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDWixJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLFNBQVMsRUFBRSxFQUFFO1lBQ3ZDLE9BQU8sTUFBTSxNQUFNLEVBQUUsQ0FBQztTQUN2QjthQUFNO1lBQ0wsTUFBTSxHQUFHLENBQUM7U0FDWDtLQUNGO0FBQ0gsQ0FBQyJ9