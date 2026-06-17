import { getJson } from './http';

export interface NpmSearchResult {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  date?: string;
  publisher?: {
    username: string;
    email?: string;
  };
  links?: {
    npm?: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };
}

export class NpmService {
  public static async getLatestVersion(packageName: string): Promise<string> {
    try {
      // npm package names can have slashes if scoped (e.g. @vudovn/ag-kit)
      const encodedPackageName = packageName.startsWith('@')
        ? `@${encodeURIComponent(packageName.substring(1))}`
        : encodeURIComponent(packageName);

      const url = `https://registry.npmjs.org/${encodedPackageName}/latest`;
      const data = await getJson<{ version: string }>(url);
      return data.version;
    } catch (error) {
      console.error(`Error fetching latest version for npm package ${packageName}:`, error);
      throw error;
    }
  }

  public static async searchPackages(
    query: string,
    page: number = 0,
    sortBy: string = 'optimal',
    pageSize: number = 20
  ): Promise<NpmSearchResult[]> {
    try {
      const from = page * pageSize;
      let url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${pageSize}&from=${from}`;
      
      if (sortBy === 'popularity') {
        url += '&popularity=1.0&quality=0.0&maintenance=0.0';
      } else if (sortBy === 'quality') {
        url += '&quality=1.0&popularity=0.0&maintenance=0.0';
      } else if (sortBy === 'maintenance') {
        url += '&maintenance=1.0&popularity=0.0&quality=0.0';
      }

      console.log(`NpmService: Fetching search URL: ${url}`);
      const data = await getJson<{ objects: { package: NpmSearchResult }[] }>(url);
      console.log(`NpmService: Received data objects: ${data.objects ? data.objects.length : 0}`);
      return (data.objects || []).map(obj => obj.package);
    } catch (error) {
      console.error(`Error searching npm packages for query "${query}":`, error);
      throw error;
    }
  }

  public static async getPackageInfo(packageName: string): Promise<{ readme?: string; license?: string }> {
    try {
      const encodedPackageName = packageName.startsWith('@')
        ? `@${encodeURIComponent(packageName.substring(1))}`
        : encodeURIComponent(packageName);
      const url = `https://registry.npmjs.org/${encodedPackageName}`;
      return await getJson<{ readme?: string; license?: string }>(url);
    } catch (error) {
      console.error(`Error fetching package info for ${packageName}:`, error);
      throw error;
    }
  }
}

