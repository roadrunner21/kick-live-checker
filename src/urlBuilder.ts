import { ApiEndpoints } from "./apiEndpoints";

export class UrlBuilder {
  constructor(private baseUrl: string) {}

  buildUrl(endpoint: keyof typeof ApiEndpoints, params: Record<string, string>): string {
    const path = ApiEndpoints[endpoint].path;
    const queryString = new URLSearchParams(params).toString();
    return `${this.baseUrl}${path}?${queryString}`;
  }
}