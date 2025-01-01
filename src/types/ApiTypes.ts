export const ApiEndpoints = {
  clips: {
    path: '/api/v2/clips',
    params: {
      sort: ['view', 'recent', 'trending'],
      time: ['day', 'week', 'month', 'all']
    }
  }
} as const;

// types/ApiTypes.ts
type ValueOf<T> = T[keyof T];
type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

export type EndpointParams<T extends keyof typeof ApiEndpoints> = {
  [K in keyof typeof ApiEndpoints[T]['params']]: ArrayElement<typeof ApiEndpoints[T]['params'][K]>;
};