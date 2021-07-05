import { retry, retryAsync } from "../../retry.ts";
const until = (lastResult) => lastResult == true;
export function retryUntilTruthy(fn, retryOptions) {
    return retry(fn, { ...retryOptions, until });
}
export function retryAsyncUntilTruthy(fn, retryOptions) {
    return retryAsync(fn, { ...retryOptions, until });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV0cnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZXRyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRW5ELE1BQU0sS0FBSyxHQUFHLENBQWMsVUFBdUIsRUFBVyxFQUFFLENBRTdELFVBQWtCLElBQUksSUFBSSxDQUFDO0FBRTlCLE1BQU0sVUFBVSxnQkFBZ0IsQ0FLOUIsRUFBNkMsRUFDN0MsWUFBZ0M7SUFFaEMsT0FBTyxLQUFLLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxZQUFZLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBRUQsTUFBTSxVQUFVLHFCQUFxQixDQUtuQyxFQUFzRCxFQUN0RCxZQUFnQztJQUVoQyxPQUFPLFVBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLFlBQVksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQ3BELENBQUMifQ==