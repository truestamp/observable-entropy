import { retry, retryAsync } from "../../retry.ts";
const until = (lastResult) => lastResult !== undefined && lastResult !== null;
export async function retryUntilDefined(fn, retryOptions) {
    const result = await retry(fn, { ...retryOptions, until });
    return result;
}
export async function retryAsyncUntilDefined(fn, options) {
    const result = await retryAsync(fn, { ...options, until });
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV0cnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZXRyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRW5ELE1BQU0sS0FBSyxHQUFHLENBQ1osVUFBMEMsRUFDakMsRUFBRSxDQUFDLFVBQVUsS0FBSyxTQUFTLElBQUksVUFBVSxLQUFLLElBQUksQ0FBQztBQUU5RCxNQUFNLENBQUMsS0FBSyxVQUFVLGlCQUFpQixDQUNyQyxFQUF3QyxFQUN4QyxZQUFnQztJQUVoQyxNQUFNLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLFlBQVksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzNELE9BQU8sTUFBTyxDQUFDO0FBQ2pCLENBQUM7QUFFRCxNQUFNLENBQUMsS0FBSyxVQUFVLHNCQUFzQixDQUMxQyxFQUFpRCxFQUNqRCxPQUEyQjtJQUUzQixNQUFNLE1BQU0sR0FBRyxNQUFNLFVBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzNELE9BQU8sTUFBTyxDQUFDO0FBQ2pCLENBQUMifQ==