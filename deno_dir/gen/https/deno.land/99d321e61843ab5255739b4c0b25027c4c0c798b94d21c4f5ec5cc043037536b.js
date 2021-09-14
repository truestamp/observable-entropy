import { retryAsyncUntilDefined, retryUntilDefined } from "./retry.ts";
export function retryUntilDefinedDecorator(fn, retryOptions) {
    return (...args) => {
        const wrappedFn = () => fn(...args);
        return retryUntilDefined(wrappedFn, retryOptions);
    };
}
export function retryAsyncUntilDefinedDecorator(fn, retryOptions) {
    return (...args) => {
        const wrappedFn = () => fn(...args);
        return retryAsyncUntilDefined(wrappedFn, retryOptions);
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlY29yYXRvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLHNCQUFzQixFQUFFLGlCQUFpQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRXZFLE1BQU0sVUFBVSwwQkFBMEIsQ0FLeEMsRUFBZ0UsRUFDaEUsWUFBZ0M7SUFFaEMsT0FBTyxDQUNMLEdBQUcsSUFBcUIsRUFDRixFQUFFO1FBQ3hCLE1BQU0sU0FBUyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQ3BDLE9BQU8saUJBQWlCLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ3BELENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCxNQUFNLFVBQVUsK0JBQStCLENBSzdDLEVBQXlFLEVBQ3pFLFlBQWdDO0lBRWhDLE9BQU8sQ0FDTCxHQUFHLElBQXFCLEVBQ0YsRUFBRTtRQUN4QixNQUFNLFNBQVMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUNwQyxPQUFPLHNCQUFzQixDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUN6RCxDQUFDLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IHNpbmNlIDIwMjAsIEZyYW5ja0xkeC4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBSZXRyeVV0aWxzT3B0aW9ucyB9IGZyb20gXCIuLi9vcHRpb25zLnRzXCI7XG5pbXBvcnQgeyByZXRyeUFzeW5jVW50aWxEZWZpbmVkLCByZXRyeVVudGlsRGVmaW5lZCB9IGZyb20gXCIuL3JldHJ5LnRzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiByZXRyeVVudGlsRGVmaW5lZERlY29yYXRvcjxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgUEFSQU1FVEVSU19UWVBFIGV4dGVuZHMgYW55W10sXG4gIFJFVFVSTl9UWVBFLFxuPihcbiAgZm46ICguLi5hcmdzOiBQQVJBTUVURVJTX1RZUEUpID0+IFJFVFVSTl9UWVBFIHwgdW5kZWZpbmVkIHwgbnVsbCxcbiAgcmV0cnlPcHRpb25zPzogUmV0cnlVdGlsc09wdGlvbnMsXG4pOiAoLi4uYXJnczogUEFSQU1FVEVSU19UWVBFKSA9PiBQcm9taXNlPFJFVFVSTl9UWVBFPiB7XG4gIHJldHVybiAoXG4gICAgLi4uYXJnczogUEFSQU1FVEVSU19UWVBFXG4gICk6IFByb21pc2U8UkVUVVJOX1RZUEU+ID0+IHtcbiAgICBjb25zdCB3cmFwcGVkRm4gPSAoKSA9PiBmbiguLi5hcmdzKTtcbiAgICByZXR1cm4gcmV0cnlVbnRpbERlZmluZWQod3JhcHBlZEZuLCByZXRyeU9wdGlvbnMpO1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmV0cnlBc3luY1VudGlsRGVmaW5lZERlY29yYXRvcjxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgUEFSQU1FVEVSU19UWVBFIGV4dGVuZHMgYW55W10sXG4gIFJFVFVSTl9UWVBFLFxuPihcbiAgZm46ICguLi5hcmdzOiBQQVJBTUVURVJTX1RZUEUpID0+IFByb21pc2U8UkVUVVJOX1RZUEUgfCB1bmRlZmluZWQgfCBudWxsPixcbiAgcmV0cnlPcHRpb25zPzogUmV0cnlVdGlsc09wdGlvbnMsXG4pOiAoLi4uYXJnczogUEFSQU1FVEVSU19UWVBFKSA9PiBQcm9taXNlPFJFVFVSTl9UWVBFPiB7XG4gIHJldHVybiAoXG4gICAgLi4uYXJnczogUEFSQU1FVEVSU19UWVBFXG4gICk6IFByb21pc2U8UkVUVVJOX1RZUEU+ID0+IHtcbiAgICBjb25zdCB3cmFwcGVkRm4gPSAoKSA9PiBmbiguLi5hcmdzKTtcbiAgICByZXR1cm4gcmV0cnlBc3luY1VudGlsRGVmaW5lZCh3cmFwcGVkRm4sIHJldHJ5T3B0aW9ucyk7XG4gIH07XG59XG4iXX0=