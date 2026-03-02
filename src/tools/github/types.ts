/**
 * Types for the GitHub integration adapter.
 */

export interface CreatePRParams {
  token: string;
  owner: string;
  repo: string;
  filePath: string;
  content: string;
  title: string;
  description?: string;
  contributorName?: string;
  version: string;
  category?: string;
  isUpdate: boolean;
  duplicateWarning?: string;
}

export interface GitHubPRResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  branch?: string;
  error?: string;
}

export interface GitHubRef {
  ref: string;
  object: {
    sha: string;
    type: string;
  };
}

export interface GitHubContentResponse {
  sha: string;
  name: string;
  path: string;
}

export interface DeletePRParams {
  token: string;
  owner: string;
  repo: string;
  filePath: string;
  reason: string;
  version: string;
  contributorName?: string;
}

export interface GitHubPullRequest {
  number: number;
  html_url: string;
  state: string;
  title: string;
}
