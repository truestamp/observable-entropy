import { retryAsyncUntilResponse } from './retry.ts';
export function retryAsyncUntilResponseDecorator(fn, retryOptions) {
    return (...args) => {
        const wrappedFn = () => fn(...args);
        return retryAsyncUntilResponse(wrappedFn, retryOptions);
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlY29yYXRvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sWUFBWSxDQUFBO0FBR2xELE1BQU0sVUFBVSxnQ0FBZ0MsQ0FLOUMsRUFBc0QsRUFDdEQsWUFBZ0M7SUFFaEMsT0FBTyxDQUFDLEdBQUcsSUFBcUIsRUFBd0IsRUFBRTtRQUN4RCxNQUFNLFNBQVMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUNwQyxPQUFPLHVCQUF1QixDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUMxRCxDQUFDLENBQUE7QUFDSCxDQUFDIn0=