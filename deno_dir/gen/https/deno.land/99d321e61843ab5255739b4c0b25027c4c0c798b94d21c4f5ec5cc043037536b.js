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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlY29yYXRvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLHNCQUFzQixFQUFFLGlCQUFpQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRXZFLE1BQU0sVUFBVSwwQkFBMEIsQ0FLeEMsRUFBZ0UsRUFDaEUsWUFBZ0M7SUFFaEMsT0FBTyxDQUNMLEdBQUcsSUFBcUIsRUFDRixFQUFFO1FBQ3hCLE1BQU0sU0FBUyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQ3BDLE9BQU8saUJBQWlCLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ3BELENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCxNQUFNLFVBQVUsK0JBQStCLENBSzdDLEVBQXlFLEVBQ3pFLFlBQWdDO0lBRWhDLE9BQU8sQ0FDTCxHQUFHLElBQXFCLEVBQ0YsRUFBRTtRQUN4QixNQUFNLFNBQVMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUNwQyxPQUFPLHNCQUFzQixDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUN6RCxDQUFDLENBQUM7QUFDSixDQUFDIn0=