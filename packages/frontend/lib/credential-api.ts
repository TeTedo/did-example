const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// W3C VC Data Model 1.1 compliant contexts
export const VC_CONTEXTS = [
  "https://www.w3.org/2018/credentials/v1",
  "https://w3id.org/security/suites/secp256k1-2019/v1",
];

// W3C Data Integrity compliant proof
export interface CredentialProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string; // W3C standard field name
}

// W3C CredentialStatusList2021
export interface CredentialStatus {
  id: string;
  type: string;
}

// W3C VC Data Model 1.1 compliant structure
export interface VerifiableCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string;
    [key: string]: unknown;
  };
  credentialStatus?: CredentialStatus;
  proof: CredentialProof;
}

export interface IssueCredentialParams {
  issuerAddress: string;
  subjectDid: string;
  type: string[];
  claims: Record<string, unknown>;
  issuanceDate: string;
  expirationDate?: string;
  signature: string;
}

export interface VerifyResult {
  valid: boolean;
  checks: {
    signature: boolean;
    notExpired: boolean;
    notRevoked: boolean;
  };
  credential?: VerifiableCredential;
  error?: string;
}

export interface CredentialStatusResult {
  id: string;
  type: string;
  status: "active" | "revoked" | "expired";
}

export const credentialApi = {
  /**
   * Issue a new Verifiable Credential (W3C compliant)
   */
  async issue(params: IssueCredentialParams): Promise<VerifiableCredential> {
    const res = await fetch(`${API_BASE_URL}/api/credentials/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Failed to issue credential");
    }
    return res.json();
  },

  /**
   * Verify a credential
   */
  async verify(credentialId: string): Promise<VerifyResult> {
    const res = await fetch(
      `${API_BASE_URL}/api/credentials/${encodeURIComponent(
        credentialId
      )}/verify`
    );
    if (!res.ok) throw new Error("Failed to verify credential");
    return res.json();
  },

  /**
   * Get credential status (W3C CredentialStatusList2021)
   */
  async getStatus(credentialId: string): Promise<CredentialStatusResult> {
    const res = await fetch(
      `${API_BASE_URL}/api/credentials/${encodeURIComponent(
        credentialId
      )}/status`
    );
    if (!res.ok) throw new Error("Failed to fetch credential status");
    return res.json();
  },

  /**
   * Get credentials by issuer or subject
   */
  async getCredentials(params: {
    issuer?: string;
    subject?: string;
  }): Promise<VerifiableCredential[]> {
    const query = new URLSearchParams();
    if (params.issuer) query.set("issuer", params.issuer);
    if (params.subject) query.set("subject", params.subject);

    const res = await fetch(`${API_BASE_URL}/api/credentials?${query}`);
    if (!res.ok) throw new Error("Failed to fetch credentials");
    return res.json();
  },

  /**
   * Get a single credential by ID
   */
  async getCredential(credentialId: string): Promise<VerifiableCredential> {
    const res = await fetch(
      `${API_BASE_URL}/api/credentials/${encodeURIComponent(credentialId)}`
    );
    if (!res.ok) throw new Error("Failed to fetch credential");
    return res.json();
  },

  /**
   * Revoke a credential
   */
  async revoke(
    credentialId: string,
    issuerAddress: string,
    signature: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch(
      `${API_BASE_URL}/api/credentials/${encodeURIComponent(
        credentialId
      )}/revoke`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issuerAddress, signature }),
      }
    );
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Failed to revoke credential");
    }
    return res.json();
  },
};

/**
 * Create the message to sign for issuing a credential (W3C compliant)
 */
export function createCredentialMessage(params: {
  issuerDid: string;
  subjectDid: string;
  type: string[];
  claims: Record<string, unknown>;
  issuanceDate: string;
  expirationDate?: string;
}): string {
  const credentialPayload = {
    "@context": VC_CONTEXTS,
    type: ["VerifiableCredential", ...params.type],
    issuer: params.issuerDid,
    issuanceDate: params.issuanceDate,
    expirationDate: params.expirationDate,
    credentialSubject: {
      id: params.subjectDid,
      ...params.claims,
    },
  };
  return JSON.stringify(credentialPayload);
}
