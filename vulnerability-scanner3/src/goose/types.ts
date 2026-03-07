export type CodeSnippet = {
  filePath: string;
  startLine: number;
  endLine: number;
  before: string;
};

export type VulnContext = {
  vulnId: string;
  packageName: string;
  version: string;
  npmSeverity: "low" | "moderate" | "high" | "critical";
  cvss: {
    score: number | null;
    vectorString: string | null;
    parsed?: {
      attackVector?: string;        // Network / Adjacent / Local / Physical
      attackComplexity?: string;    // Low / High
      privilegesRequired?: string;  // None / Low / High
      userInteraction?: string;     // None / Required
      confidentiality?: string;     // None / Low / High
      integrity?: string;           // None / Low / High
      availability?: string;        // None / Low / High
    };
  };
  cwe?: {
    ids: string[];    // e.g. ["CWE-79"]
    names: string[];  // e.g. ["Improper Neutralization of Input During Web Page Generation (XSS)"]
  };
  githubAdvisory?: {
    id?: string;
    summary?: string;
    url?: string;
  };
  paths: string[][];        // dependency chains from root -> this package
  usedInFiles: string[];    // files where this package is imported/used
  environment: "dev" | "staging" | "prod";
  projectType: string;      // e.g. "ngo-web-app"
  fixAvailable: {
    type: "auto" | "manual" | "none";
    name?: string;
    version?: string;
    isSemVerMajor?: boolean;
    resolvesCount?: number;
  };
  codeSnippet?: CodeSnippet;
};

export type CodeFix = {
  filePath: string;
  before: string;
  after: string;
  description: string;
  warnings: string[];
};

export type GooseVulnInsight = {
  title: string;                    // Short vulnerability label for card title
  humanExplanation: string;         // 2-3 sentences, plain language
  impactOnUsers: string;           // 1-2 sentences about realistic impact for THIS project
  priorityScore: number;           // 1 (lowest) to 5 (highest)
  priorityReason: string;          // 1-2 sentences explaining the score
  recommendedActions: string[];    // 3-7 actionable steps
  fixStyle: string;               // Upgrade type classification  
  devFacingSummary: string;       // 1-2 sentence TL;DR for Inspector header
  codeFix?: CodeFix;              // Optional, only when codeSnippet provided
};
  