export interface Library {
  id: string;
  name: string;
  description: string;
  github?: string;      // e.g., "vudovn/ag-kit"
  npmPackage?: string;  // e.g., "@vudovn/ag-kit"
  commands: {
    init: string;
    global?: string;
    [key: string]: string | undefined;
  };
  currentVersion: string; // latest known version
  lastChecked?: string;
}

export interface ProjectPackage {
  id: string;
  scope: 'local' | 'global';
  installedVersion: string;
  installedAt: string;
}

export interface ProjectConfig {
  installedPackages: ProjectPackage[];
}
