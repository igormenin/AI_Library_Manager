import { getJson, postJson, patchJson } from './http';

interface GitHubRelease {
  tag_name: string;
}

interface GitHubTag {
  name: string;
}

interface GistResponse {
  id: string;
  html_url: string;
  files: Record<string, { content: string; filename: string }>;
}

export class GitHubService {
  public static async getLatestVersion(repo: string): Promise<string> {
    try {
      const url = `https://api.github.com/repos/${repo}/releases/latest`;
      const release = await getJson<GitHubRelease>(url);
      return release.tag_name.replace(/^v/, ''); // remove leading 'v' if present
    } catch (error) {
      // Fallback to tags if no official release exists
      try {
        const url = `https://api.github.com/repos/${repo}/tags`;
        const tags = await getJson<GitHubTag[]>(url);
        if (tags && tags.length > 0) {
          return tags[0].name.replace(/^v/, '');
        }
      } catch (tagError) {
        console.error(`Error fetching tags for GitHub repo ${repo}:`, tagError);
      }
      console.error(`Error fetching latest release for GitHub repo ${repo}:`, error);
      throw error;
    }
  }

  private static getHeaders(token: string): Record<string, string> {
    return {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };
  }

  public static async createGist(
    token: string,
    description: string,
    files: Record<string, { content: string }>
  ): Promise<GistResponse> {
    const url = 'https://api.github.com/gists';
    const body = {
      description,
      public: false,
      files
    };
    return postJson<GistResponse>(url, body, this.getHeaders(token));
  }

  public static async updateGist(
    token: string,
    gistId: string,
    files: Record<string, { content: string | null }>
  ): Promise<GistResponse> {
    const url = `https://api.github.com/gists/${gistId}`;
    const body = {
      files
    };
    return patchJson<GistResponse>(url, body, this.getHeaders(token));
  }

  public static async getGist(token: string, gistId: string): Promise<GistResponse> {
    const url = `https://api.github.com/gists/${gistId}`;
    return getJson<GistResponse>(url, this.getHeaders(token));
  }

  public static async validateToken(token: string): Promise<boolean> {
    try {
      const url = 'https://api.github.com/gists?per_page=1';
      await getJson(url, this.getHeaders(token));
      return true;
    } catch (error) {
      console.error('GitHub token validation failed:', error);
      return false;
    }
  }
}
