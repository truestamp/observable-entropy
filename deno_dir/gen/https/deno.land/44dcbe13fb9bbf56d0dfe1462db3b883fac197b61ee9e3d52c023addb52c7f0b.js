import { retry, retryAsync } from "../retry.ts";
export const retryHof = (until)=>(fn, retryOptions)=>retry(fn, {
            ...retryOptions,
            until
        });
export const retryAsyncHof = (until)=>(fn, retryOptions)=>retryAsync(fn, {
            ...retryOptions,
            until
        });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvcmV0cnlAdjIuMC4wL3JldHJ5L3V0aWxzL3Rvb2xzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFVOVElMIH0gZnJvbSBcIi4uL29wdGlvbnMudHNcIjtcbmltcG9ydCB7IHJldHJ5LCByZXRyeUFzeW5jIH0gZnJvbSBcIi4uL3JldHJ5LnRzXCI7XG5pbXBvcnQgeyBSZXRyeVV0aWxzT3B0aW9ucyB9IGZyb20gXCIuL29wdGlvbnMudHNcIjtcblxuZXhwb3J0IGNvbnN0IHJldHJ5SG9mID0gPFJFVFVSTl9UWVBFPih1bnRpbDogVU5USUw8UkVUVVJOX1RZUEU+KSA9PlxuICAoXG4gICAgZm46ICgpID0+IFJFVFVSTl9UWVBFLFxuICAgIHJldHJ5T3B0aW9ucz86IFJldHJ5VXRpbHNPcHRpb25zLFxuICApOiBQcm9taXNlPFJFVFVSTl9UWVBFPiA9PiByZXRyeShmbiwgeyAuLi5yZXRyeU9wdGlvbnMsIHVudGlsIH0pO1xuXG5leHBvcnQgY29uc3QgcmV0cnlBc3luY0hvZiA9IDxSRVRVUk5fVFlQRT4odW50aWw6IFVOVElMPFJFVFVSTl9UWVBFPikgPT5cbiAgKFxuICAgIGZuOiAoKSA9PiBQcm9taXNlPFJFVFVSTl9UWVBFPixcbiAgICByZXRyeU9wdGlvbnM/OiBSZXRyeVV0aWxzT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxSRVRVUk5fVFlQRT4gPT4gcmV0cnlBc3luYyhmbiwgeyAuLi5yZXRyeU9wdGlvbnMsIHVudGlsIH0pO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLFNBQVMsS0FBSyxFQUFFLFVBQVUsUUFBUSxhQUFhLENBQUM7QUFHaEQsT0FBTyxNQUFNLFFBQVEsR0FBRyxDQUFjLEtBQXlCLEdBQzdELENBQ0UsRUFBcUIsRUFDckIsWUFBZ0MsR0FDUCxLQUFLLENBQUMsRUFBRSxFQUFFO1lBQUUsR0FBRyxZQUFZO1lBQUUsS0FBSztTQUFFLENBQUMsQ0FBQztBQUVuRSxPQUFPLE1BQU0sYUFBYSxHQUFHLENBQWMsS0FBeUIsR0FDbEUsQ0FDRSxFQUE4QixFQUM5QixZQUFnQyxHQUNQLFVBQVUsQ0FBQyxFQUFFLEVBQUU7WUFBRSxHQUFHLFlBQVk7WUFBRSxLQUFLO1NBQUUsQ0FBQyxDQUFDIn0=