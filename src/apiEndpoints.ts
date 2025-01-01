export const ApiEndpoints = {
  clips: {
    path: '/api/v2/clips',
    params: {
      sort: ['view', 'recent', 'trending'] as const,
      time: ['day', 'week', 'month', 'all'] as const
    }
  },
  // Add other endpoints as needed
} as const;