import { deferred } from "./deps.ts";
export const asyncDecorator = (fn) => {
    return () => {
        const promise = deferred();
        try {
            const result = fn();
            promise.resolve(result);
        }
        catch (err) {
            promise.reject(err);
        }
        return promise;
    };
};
export const assertDefined = (value, errMsg) => {
    if (value === undefined || value == null) {
        throw new Error(errMsg);
    }
    return true;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlzYy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1pc2MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUVyQyxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQUcsQ0FBSSxFQUFXLEVBQUUsRUFBRTtJQUMvQyxPQUFPLEdBQWUsRUFBRTtRQUN0QixNQUFNLE9BQU8sR0FBRyxRQUFRLEVBQUssQ0FBQztRQUM5QixJQUFJO1lBQ0YsTUFBTSxNQUFNLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDcEIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN6QjtRQUFDLE9BQU8sR0FBRyxFQUFFO1lBQ1osT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNyQjtRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQztBQUVGLE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBRyxDQUMzQixLQUEyQixFQUMzQixNQUFjLEVBQ0YsRUFBRTtJQUNkLElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLElBQUksSUFBSSxFQUFFO1FBQ3hDLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDekI7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMsQ0FBQyJ9