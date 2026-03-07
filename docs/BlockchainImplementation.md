## **Trident – Scan Receipts, Hashing, and Anchoring**

## **Goal**

Build a receipts system for Trident that:

- Generates a **ScanReceipt** for production scans (VS Code extension.
- Stores receipts in **Supabase** (append‑only for prod).
- Automatically computes a **hash** for each receipt.
- Optionally **anchors** the hash on a cheap blockchain using a **SecureMap service wallet**, without requiring user wallets.
- Lets companies verify scans later via hashes and (optionally) on-chain proofs.

---

## **Architecture Decisions**

### **Backend Stack**
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with API routes
- **Database**: Supabase (PostgreSQL + real-time features)
- **Blockchain**: Polygon Amoy Testnet
- **Deployment**: Vercel (serverless functions)
- **Authentication**: MVP API Keys → V2 Supabase Auth

### **Dependencies**

#### **Production Dependencies**
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "@supabase/supabase-js": "^2.38.0",
  "ethers": "^6.8.1",
  "crypto-js": "^4.2.0",
  "joi": "^17.11.0",
  "uuid": "^9.0.1",
  "dotenv": "^16.3.1",
  "node-cron": "^3.0.3"
}
```

#### **Development Dependencies**
```json
{
  "@types/jest": "^29.5.8",
  "@types/express": "^4.17.21",
  "@types/cors": "^2.8.17",
  "@types/crypto-js": "^4.2.1",
  "@types/uuid": "^9.0.7",
  "@types/node-cron": "^3.0.11",
  "jest": "^29.7.0",
  "nodemon": "^3.0.2",
  "supertest": "^6.3.3",
  "ts-jest": "^29.1.1"
}
```

### **Environment Variables**
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Blockchain Configuration  
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
SERVICE_WALLET_PRIVATE_KEY=0x1234567890abcdef...
CHAIN_NETWORK=polygon-amoy
CHAIN_ID=80002

# API Configuration
API_PORT=3001
CORS_ORIGINS=http://localhost:3000,vscode-webview://
API_SECRET_KEY=your-secret-key-here

# MVP Authentication (V1)
DEFAULT_ORG_ID=org_default_001
DEFAULT_PROJECT_ID=proj_default_001

# Feature Flags
ENABLE_BLOCKCHAIN_ANCHORING=true
ENABLE_RECEIPT_VERIFICATION=true
DEBUG_MODE=true
```

### **MVP Authentication Strategy (V1)**

**Simple API Key Approach:**
- Each organization gets a unique API key
- VS Code extension includes API key in requests
- Backend validates key → maps to orgId/projectId
- No user signup/login required for MVP

**API Key Structure:**
```
sk_org_[org_id]_[random_hash]
Example: sk_org_001_a1b2c3d4e5f6
```

**Authentication Flow:**
1. VS Code extension sends API key in Authorization header
2. Backend validates key format and existence
3. Maps key to default orgId/projectId for MVP
4. Proceeds with receipt creation

**V2 Migration Path:**
- Replace API keys with Supabase Auth
- Add user management, role-based access
- Multi-organization membership
- Granular permissions

---



## **Service wallet vs. org wallets**

- **MVP**: SecureMap has a single **service wallet** dedicated to anchoring receipt hashes.
- Users:
    - Don’t provide wallets.
    - Just toggle “Anchor on chain” on/off.
- Future: allow **org wallets** (BYO wallet) to anchor from their address if needed.(V2)

---

## **Data Model**

## **ScanReceipt Type (conceptual)**

Fields (simplified):

- Identification
    - `id: string` (UUID)
    - `orgId: string`
    - `projectId: string`
- Scan context
    - `repo: string` (e.g., `org/repo`)
    - `commit: string` (commit SHA)
    - `environment: 'production' | 'staging' | 'development'`
    - `timestamp: string` (ISO 8601)
    - `tool: string` (e.g., `securemap-npm-audit`)
- Summary
    - `totalDependencies: number`
    - `vulnerableDependencies: number`
    - `totalVulnerabilities: number`
    - `critical: number`
    - `high: number`
    - `medium: number`
    - `low: number`
    - `status: 'pass' | 'fail'`
- Hashes
    - `receiptHash: string` (required)
    - `scanHash?: string` (hash of full SBOM/scan, optional)
- Storage references
    - `scanLocation?: string` (pointer like `supabase://bucket/key.json` or S3 URL)
- Anchoring
    - `anchoringRequested: boolean`
    - `anchored: boolean`
    - `chainTxId: string | null`
    - `chainNetwork: string | null` (e.g., `polygon-amoy`, `arbitrum-sepolia`)
- Audit
    - `createdAt: string`
    - `createdByUserId: string`

---

## **Supabase Design**

## **Tables**

1. `organizations`
    - `id` (PK)
    - `name`
    - `settings` JSONB (may later hold org wallet address)
2. `projects`
    - `id` (PK)
    - `org_id` (FK → organizations.id)
    - `name`
    - `repo` (e.g., `org/repo`)
3. `scan_receipts`
    - `id` (PK, UUID)
    - `org_id` (FK → organizations.id)
    - `project_id` (FK → projects.id)
    - `repo`
    - `commit`
    - `environment`
    - `timestamp`
    - `tool`
    - `total_dependencies`
    - `vulnerable_dependencies`
    - `total_vulnerabilities`
    - `critical`
    - `high`
    - `medium`
    - `low`
    - `status`
    - `receipt_hash` (TEXT, NOT NULL)
    - `scan_hash` (TEXT, nullable)
    - `scan_location` (TEXT, nullable)
    - `anchoring_requested` (BOOLEAN, default false)
    - `anchored` (BOOLEAN, default false)
    - `chain_tx_id` (TEXT, nullable)
    - `chain_network` (TEXT, nullable)
    - `created_at` (TIMESTAMPTZ, default now())
    - `created_by_user_id` (FK → users.id)

## **RLS / Security rules (intent)**

- Enable **Row Level Security** on `scan_receipts`.
- Policies:
    - Insert:
        - Authenticated users can insert rows where `org_id` is one of their orgs.
    - Select:
        - Authenticated users can select rows where `org_id` is one of their orgs.
    - Update/Delete:
        - For `environment = 'production'`, **no updates or deletes** allowed.
        - Non‑prod rows may be updatable if needed, but you can also keep them append‑only.

This makes receipts effectively **append‑only** for production.

---

## **Hashing Strategy**

## **What gets hashed?**

For MVP, hash a **stable subset**:

- `repo`
- `commit`
- `environment`
- `timestamp`
- `summary` block (dependency/vuln counts + status)
- goose summary

You serialize those into a **canonical JSON string** and compute SHA‑256.

Example canonical content (conceptual):

```jsx
json{
  "repo": "acme/api-service",
  "commit": "abc123",
  "environment": "production",
  "timestamp": "2026-03-03T16:30:00Z",
  "summary": {
    "totalDependencies": 124,
    "vulnerableDependencies": 7,
    "totalVulnerabilities": 10,
    "critical": 1,
    "high": 3,
    "medium": 4,
    "low": 2,
    "status": "fail"
  }
}
```

## **Auto-creation flow**

When creating a new receipt (backend):

1. Build an object with those fields (without `receiptHash`).
2. Canonicalize (e.g., fixed key order, `JSON.stringify`).
3. Compute SHA‑256 → hex string.
4. Set `receiptHash` on the receipt object.
5. Insert into `scan_receipts`.
6. If `anchoringRequested` is true, queue an anchoring job.

---

## **Anchoring Flow (Service Wallet, Optional)**

## **Chain choice**

- Using PolyGon
- You control one **service wallet** with enough testnet funds.
- Purpose: write minimal transactions that record `receiptHash` and maybe a short tag.

## **Anchoring job**

When a receipt is created with `anchoringRequested = true`:

1. Receipt is inserted into Supabase with:
    - `anchored = false`
    - `chainTxId = null`
    - `chainNetwork = <your-default-network>`
2. Background worker (or serverless function) reads pending receipts:
    - For each:
        - Send a transaction from the **service wallet** that:
            - Includes `receiptHash` as data (e.g., in a contract call or event log).
        - Wait for confirmation.
        - Update the row:
            - `anchored = true`
            - `chainTxId = <tx hash>`
            - `chainNetwork = <network name>`

## **Verification story**

Given a receipt JSON:

1. Recompute SHA‑256 → `computedHash`.
2. Compare to `receiptHash` in DB.
3. If `anchored = true`:
    - Use `chainTxId` + `chainNetwork` to fetch the transaction from a block explorer/node.
    - Confirm that `receiptHash` appears in the chain data and matches `computedHash`.

---

## **UX – VS Code Extension**

## **Production Scan + Receipt Button**

In Trident's VS Code UI:

- Button: **“Production Scan Receipt”**
- Options in a small panel/modal:
    - Environment: `production` (read‑only for this button).
    - Checkbox / toggle: **“Anchor on blockchain (recommended)”**
        - Popup Tooltip: “Anchors only a cryptographic hash of this summary using SecureMap’s service wallet. No code or dependency details go on chain.”

When clicked:

1. Extension runs the production scan (npm audit, etc.).
2. Extension computes counts and status OR sends raw scan to backend for processing.
3. Extension calls backend API: `POST /scan-receipts` with:
    - Org/project identity (token).
    - Scan summary fields.
    - `anchoringRequested` (from the toggle).
4. Backend:
    - Builds receipt object.
    - Computes `receiptHash`.
    - Saves to Supabase.
    - Returns the stored receipt (with `id`, `receiptHash`, `anchored`, etc.).
5. Extension UI:
    - Shows a “Receipt created” message.
    - Shows status:
        - If anchoring requested:
            - “Anchoring in progress…” then update later (or lazy fetch).
        - If not:
            - “Receipt stored (off-chain only).”

---

## **UX – CLI (ADD TO V2)**

Command shape:

`bashsecuremap scan \
  --env production \
  --with-receipt \
  --anchor      # optional flag`

Behavior:

- Runs the same scan logic.
- Either:
    - Calls the same backend `POST /scan-receipts`, or
    - Directly talks to Supabase using the same hashing helper.
- Outputs:
    - Receipt `id`.
    - `receiptHash`.
    - `anchored` / `chainTxId` if available.

Later you can add:

`bashsecuremap receipts verify --id <receiptId>`

to re-hash and optionally cross-check the chain.

---

## **Policy and Status**

## **Pass / fail rules**

Define a project/org policy (per project or org):

- Examples:
    - Fail if any **critical** vulnerabilities.
    - Fail if any **high** in production.
    - Allow medium/low but log them.

`status` on the receipt is based on:

- Did the scan technically succeed?
- Did results satisfy policy?

## **Non-anchored receipts**

If user leaves “Anchor on blockchain” off:

- You still compute `receiptHash`.
- You still store the receipt in Supabase.
- `anchoringRequested = false`, `anchored = false`, `chainTxId = null`.
- Verification relies on:
    - Recomputing `receiptHash`.
    - Trusting your DB + internal controls.

Still valuable: history + internal audit.

---

## **COMPREHENSIVE SPECIFICATIONS**

### **A. Product & Design Decisions**

#### **Pass/Fail Policy (Finalized)**
```typescript
// Default Policy for MVP
const DEFAULT_SCAN_POLICY = {
  failOnCritical: true,    // Any critical vulnerability = FAIL
  failOnHigh: true,        // Any high vulnerability = FAIL  
  maxMedium: null,         // Medium vulnerabilities allowed
  maxLow: null,           // Low vulnerabilities allowed
  
  // Status calculation: 
  // FAIL if: critical > 0 OR high > 0 OR scan error
  // PASS if: critical = 0 AND high = 0 AND no scan errors
};
```

#### **Anchoring Checkbox Tooltip (Exact Text)**
```html
"Securely stores a cryptographic fingerprint of your scan results on Polygon blockchain for independent verification. Only the hash is stored - no code or dependency details are revealed. Recommended for production environments and compliance requirements."
```

#### **Goose Summary Fields (Exact Specification)**
```typescript
interface GooseSummaryForReceipt {
  topVulnerabilities: Array<{
    packageName: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;           // Brief vulnerability name
    priorityScore: number;   // 1-5 from Goose analysis
    riskSummary: string;     // 1-2 sentence impact summary
  }>;  // Max 3 vulnerabilities
  
  environmentRisk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    reasoning: string;       // Why this risk level for this environment
  };
  
  overallAssessment: string; // 2-3 sentence executive summary
}
```

#### **Receipt Visual Design (Defined)**
- **Colors**: Gradient blue (#667eea to #764ba2) with white text
- **Font**: Monospace (Courier New) for technical authenticity
- **Logo**: "🔒 TRIDENT SCAN RECEIPT" header
- **Above fold**: Receipt ID, repo/commit, timestamp, PASS/FAIL status, vulnerability counts
- **Below fold**: Receipt hash, blockchain status, transaction ID, Goose summary, verification link

#### **Project Defaults (Confirmed)**
```typescript
const PROJECT_DEFAULTS = {
  primaryBranch: 'main',         // Default, with auto-detection fallback
  anchoringDefault: true,        // For production environment
  retentionDays: 365,           // 1 year default retention
  scanTimeout: 300,             // 5 minute scan timeout
};
```

### **B. Security & Governance Decisions**

#### **Retention Policy (Defined)**
- **Default**: 365 days for all receipts
- **Production**: Indefinite retention (compliance requirement)
- **Staging**: 180 days  
- **Development**: 90 days
- **V2**: Organization-configurable retention policies

#### **Receipt Signature Strategy (V2 Roadmap)**
```typescript
// Future enhancement - not in MVP
interface ReceiptSignature {
  algorithm: 'ECDSA-secp256k1';
  signerType: 'service-wallet';    // MVP uses service wallet
  receiptHash: string;
  signature: string;               // Hex-encoded signature
  timestamp: number;
}
```

#### **Access Control Policy (Finalized)**
- **MVP**: Private receipts (organization-only access)
- **Public verification**: Not implemented in MVP
- **V2**: Token-based public verification for public repositories
- **Data sharing**: Never share source code, only vulnerability counts and hashes

### **C. Blockchain & Wallet Setup**

#### **Infrastructure Provider (Selected)**
- **RPC Provider**: Polygon official RPC (https://rpc-amoy.polygon.technology)
- **Backup**: Alchemy or QuickNode for production reliability
- **Network**: Polygon Amoy Testnet (Chain ID: 80002)

#### **Service Wallet Security (Defined)**
- **Generation**: Create offline with ethers.js Wallet.createRandom()
- **Storage**: Environment variable (NEVER commit to repo)
- **Funding**: Polygon Amoy faucet (https://faucet.polygon.technology/)
- **Usage**: Dedicated to receipt anchoring only
- **Backup**: Document private key in secure password manager

#### **Anchoring Cadence (Decided)**
- **Immediate**: Anchor each receipt immediately when requested
- **Background**: Use Vercel cron job every 5 minutes to process queue
- **Batch size**: Process up to 10 receipts per batch
- **Retry**: 3 attempts with exponential backoff for failed transactions

### **D. Integration with Goose and CLI**

#### **Goose Prompt (Exact Instructions)**
```markdown
You are analyzing vulnerability scan results for executive security reporting.
Create a concise risk assessment suitable for compliance documentation.

INPUT: Vulnerability scan results with counts and package details
OUTPUT: JSON matching GooseSummaryForReceipt interface

REQUIREMENTS:
- Focus on business impact, not technical remediation
- Maximum 3 most critical vulnerabilities by severity and business risk  
- Consider environment (production = higher risk than development)
- Executive-friendly language (avoid technical jargon)
- Deterministic output (same input = same output)
- No remediation code or specific commands
- No external links or version recommendations
```

#### **CLI Integration Points (Defined)**
```bash
# V1: Backend API integration
POST /api/receipts
- Accepts: scan results + environment + anchoring preference
- Returns: receipt ID + hash + anchoring status

# V2: CLI commands 
trt scan --env production --with-receipt --anchor
# Output: "Receipt created: rec_abc123 | Hash: 0xdef456 | Anchoring: pending"

trt receipts verify --id rec_abc123  
# Output: "Receipt verified ✓ | Anchored: 0x789abc | Block: 12345678"
```

### **E. Documentation & Positioning**

#### **User Education (Exact Wording)**

**"What is a Trident ScanReceipt?"**
> A ScanReceipt is a cryptographic proof that you performed a security vulnerability scan at a specific point in time. It includes a summary of findings and AI-generated risk assessment, but never your actual source code. Think of it as a tamper-proof timestamp for your security practices.

**"What does anchoring mean?"**
> Anchoring stores a cryptographic fingerprint on Polygon blockchain for independent verification. Anyone can verify your receipt's authenticity without accessing your systems. It's like notarizing a document, but for security scan results.

**"What data do we store?"**
- ✅ **We store**: Vulnerability counts, timestamps, pass/fail status, repo name, AI summary
- ❌ **Never stored**: Source code, file names, dependency versions, environment variables
- 🔒 **On blockchain**: Only cryptographic hash - no readable data

#### **Anchoring Recommendation Level (Decided)**
**"Recommended for regulated teams and production environments"**

**Marketing positioning:**
- Essential for compliance (SOC 2, ISO 27001, SOX)
- Independent verification without vendor lock-in
- Cryptographic audit trail for security diligence
- Perfect for financial services, healthcare, government

---

## **Implementation Phases**

### **Phase 1: Foundation Backend (Week 1)**
- Set up Express.js API with TypeScript
- Configure Supabase integration
- Implement basic receipt generation and hashing
- Create MVP API key authentication
- Deploy to Vercel

### **Phase 2: Blockchain Integration (Week 2)**  
- Set up service wallet and Polygon Amoy connection
- Implement anchoring service with background jobs
- Add transaction verification system
- Integrate with receipt system

### **Phase 3: VS Code Integration (Week 3)**
- Add "Production Scan Receipt" button to extension
- Implement blockchain anchoring toggle
- Add receipt status display and verification UI
- End-to-end testing

### **Vercel Configuration**
Create `vercel.json`:
```json
{
  "functions": {
    "api/**/*.js": {
      "runtime": "@vercel/node"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```