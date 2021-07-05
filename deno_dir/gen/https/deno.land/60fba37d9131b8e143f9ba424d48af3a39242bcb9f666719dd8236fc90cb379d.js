import { retryAsyncUntilTruthy, retryUntilTruthy } from "./retry.ts";
export function retryUntilTruthyDecorator(fn, retryOptions) {
    return (...args) => {
        const wrappedFn = () => fn(...args);
        return retryUntilTruthy(wrappedFn, retryOptions);
    };
}
export function retryAsyncUntilTruthyDecorator(fn, retryOptions) {
    return (...args) => {
        const wrappedFn = () => fn(...args);
        return retryAsyncUntilTruthy(wrappedFn, retryOptions);
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlY29yYXRvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLHFCQUFxQixFQUFFLGdCQUFnQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRXJFLE1BQU0sVUFBVSx5QkFBeUIsQ0FLdkMsRUFBNkMsRUFDN0MsWUFBZ0M7SUFFaEMsT0FBTyxDQUFDLEdBQUcsSUFBcUIsRUFBd0IsRUFBRTtRQUN4RCxNQUFNLFNBQVMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUNwQyxPQUFPLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNuRCxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxVQUFVLDhCQUE4QixDQUs1QyxFQUFzRCxFQUN0RCxZQUFnQztJQUVoQyxPQUFPLENBQUMsR0FBRyxJQUFxQixFQUF3QixFQUFFO1FBQ3hELE1BQU0sU0FBUyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQ3BDLE9BQU8scUJBQXFCLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ3hELENBQUMsQ0FBQztBQUNKLENBQUMifQ==