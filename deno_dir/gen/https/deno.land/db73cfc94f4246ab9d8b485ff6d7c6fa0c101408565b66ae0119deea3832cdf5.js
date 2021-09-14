import { retry, retryAsync } from "../../retry.ts";
const until = (lastResult) => lastResult == true;
export function retryUntilTruthy(fn, retryOptions) {
    return retry(fn, { ...retryOptions, until });
}
export function retryAsyncUntilTruthy(fn, retryOptions) {
    return retryAsync(fn, { ...retryOptions, until });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmV0cnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZXRyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRW5ELE1BQU0sS0FBSyxHQUFHLENBQWMsVUFBdUIsRUFBVyxFQUFFLENBRTdELFVBQWtCLElBQUksSUFBSSxDQUFDO0FBRTlCLE1BQU0sVUFBVSxnQkFBZ0IsQ0FLOUIsRUFBNkMsRUFDN0MsWUFBZ0M7SUFFaEMsT0FBTyxLQUFLLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxZQUFZLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBRUQsTUFBTSxVQUFVLHFCQUFxQixDQUtuQyxFQUFzRCxFQUN0RCxZQUFnQztJQUVoQyxPQUFPLFVBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLFlBQVksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQ3BELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgc2luY2UgMjAyMCwgRnJhbmNrTGR4LiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmltcG9ydCB7IFJldHJ5VXRpbHNPcHRpb25zIH0gZnJvbSBcIi4uL29wdGlvbnMudHNcIjtcbmltcG9ydCB7IHJldHJ5LCByZXRyeUFzeW5jIH0gZnJvbSBcIi4uLy4uL3JldHJ5LnRzXCI7XG5cbmNvbnN0IHVudGlsID0gPFJFVFVSTl9UWVBFPihsYXN0UmVzdWx0OiBSRVRVUk5fVFlQRSk6IGJvb2xlYW4gPT5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgKGxhc3RSZXN1bHQgYXMgYW55KSA9PSB0cnVlO1xuXG5leHBvcnQgZnVuY3Rpb24gcmV0cnlVbnRpbFRydXRoeTxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgUEFSQU1FVEVSU19UWVBFIGV4dGVuZHMgYW55W10sXG4gIFJFVFVSTl9UWVBFLFxuPihcbiAgZm46ICguLi5hcmdzOiBQQVJBTUVURVJTX1RZUEUpID0+IFJFVFVSTl9UWVBFLFxuICByZXRyeU9wdGlvbnM/OiBSZXRyeVV0aWxzT3B0aW9ucyxcbik6IFByb21pc2U8UkVUVVJOX1RZUEU+IHtcbiAgcmV0dXJuIHJldHJ5KGZuLCB7IC4uLnJldHJ5T3B0aW9ucywgdW50aWwgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXRyeUFzeW5jVW50aWxUcnV0aHk8XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIFBBUkFNRVRFUlNfVFlQRSBleHRlbmRzIGFueVtdLFxuICBSRVRVUk5fVFlQRSxcbj4oXG4gIGZuOiAoLi4uYXJnczogUEFSQU1FVEVSU19UWVBFKSA9PiBQcm9taXNlPFJFVFVSTl9UWVBFPixcbiAgcmV0cnlPcHRpb25zPzogUmV0cnlVdGlsc09wdGlvbnMsXG4pOiBQcm9taXNlPFJFVFVSTl9UWVBFPiB7XG4gIHJldHVybiByZXRyeUFzeW5jKGZuLCB7IC4uLnJldHJ5T3B0aW9ucywgdW50aWwgfSk7XG59XG4iXX0=