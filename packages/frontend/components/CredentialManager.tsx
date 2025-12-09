"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { isAddress } from "viem";
import {
  credentialApi,
  createCredentialMessage,
  VerifiableCredential,
  VerifyResult,
} from "@/lib/credential-api";

// Preset credential types
const CREDENTIAL_TYPES = [
  { value: "UniversityDegreeCredential", label: "대학 학위" },
  { value: "EmploymentCredential", label: "재직 증명" },
  { value: "MembershipCredential", label: "멤버십" },
  { value: "CertificationCredential", label: "자격증" },
  { value: "AchievementCredential", label: "업적/성과" },
];

export function CredentialManager() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // State
  const [activeTab, setActiveTab] = useState<"issue" | "my" | "verify">("my");
  const [issuedCredentials, setIssuedCredentials] = useState<
    VerifiableCredential[]
  >([]);
  const [receivedCredentials, setReceivedCredentials] = useState<
    VerifiableCredential[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Issue form state
  const [subjectDid, setSubjectDid] = useState("");
  const [credentialType, setCredentialType] = useState(
    CREDENTIAL_TYPES[0].value
  );
  const [claimKey, setClaimKey] = useState("");
  const [claimValue, setClaimValue] = useState("");
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [expirationDays, setExpirationDays] = useState("365");

  // Verify state
  const [verifyId, setVerifyId] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const myDid = address ? `did:ethr:${address.toLowerCase()}` : "";

  // Load credentials
  const loadCredentials = useCallback(async () => {
    if (!myDid) return;

    setLoading(true);
    try {
      const [issued, received] = await Promise.all([
        credentialApi.getCredentials({ issuer: myDid }),
        credentialApi.getCredentials({ subject: myDid }),
      ]);
      setIssuedCredentials(issued);
      setReceivedCredentials(received);
    } catch (err) {
      console.error("Failed to load credentials:", err);
    } finally {
      setLoading(false);
    }
  }, [myDid]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  // Add claim
  const handleAddClaim = () => {
    if (!claimKey.trim() || !claimValue.trim()) return;
    setClaims((prev) => ({ ...prev, [claimKey]: claimValue }));
    setClaimKey("");
    setClaimValue("");
  };

  // Remove claim
  const handleRemoveClaim = (key: string) => {
    setClaims((prev) => {
      const newClaims = { ...prev };
      delete newClaims[key];
      return newClaims;
    });
  };

  // Issue credential
  const handleIssue = async () => {
    if (!address) return;

    // Validate subject DID
    const subjectAddress = subjectDid.split(":").pop();
    if (!subjectAddress || !isAddress(subjectAddress)) {
      setError("유효한 Subject DID를 입력하세요 (did:ethr:0x...)");
      return;
    }

    if (Object.keys(claims).length === 0) {
      setError("최소 하나의 클레임을 추가하세요");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const issuanceDate = new Date().toISOString();
      const expirationDate = expirationDays
        ? new Date(
            Date.now() + parseInt(expirationDays) * 24 * 60 * 60 * 1000
          ).toISOString()
        : undefined;

      // Create message to sign
      const message = createCredentialMessage({
        issuerDid: myDid,
        subjectDid,
        type: [credentialType],
        claims,
        issuanceDate,
        expirationDate,
      });

      // Sign the message
      const signature = await signMessageAsync({ message });

      // Issue the credential
      const vc = await credentialApi.issue({
        issuerAddress: address,
        subjectDid,
        type: [credentialType],
        claims,
        issuanceDate,
        expirationDate,
        signature,
      });

      setSuccess(`자격증명이 발급되었습니다! ID: ${vc.id}`);
      setClaims({});
      setSubjectDid("");
      loadCredentials();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "발급 중 오류가 발생했습니다";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Verify credential
  const handleVerify = async () => {
    if (!verifyId.trim()) return;

    setLoading(true);
    setVerifyResult(null);

    try {
      const result = await credentialApi.verify(verifyId);
      setVerifyResult(result);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "검증 중 오류가 발생했습니다";
      setVerifyResult({
        valid: false,
        checks: { signature: false, notExpired: false, notRevoked: false },
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Revoke credential
  const handleRevoke = async (credentialId: string) => {
    if (!address) return;

    if (!confirm("정말 이 자격증명을 폐기하시겠습니까?")) return;

    setLoading(true);
    setError(null);

    try {
      const message = `Revoke credential: ${credentialId}`;
      const signature = await signMessageAsync({ message });

      await credentialApi.revoke(credentialId, address, signature);
      setSuccess("자격증명이 폐기되었습니다");
      loadCredentials();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "폐기 중 오류가 발생했습니다";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">
        🎓 자격증명 (Verifiable Credentials)
      </h2>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("my")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "my"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          내 자격증명
        </button>
        <button
          onClick={() => setActiveTab("issue")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "issue"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          발급하기
        </button>
        <button
          onClick={() => setActiveTab("verify")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "verify"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          검증하기
        </button>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* My Credentials Tab */}
      {activeTab === "my" && (
        <div className="space-y-6">
          {/* Received Credentials */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-900">
              📥 받은 자격증명 ({receivedCredentials.length})
            </h3>
            {receivedCredentials.length === 0 ? (
              <p className="text-sm text-gray-500">
                아직 받은 자격증명이 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {receivedCredentials.map((vc) => (
                  <CredentialCard key={vc.id} credential={vc} />
                ))}
              </div>
            )}
          </div>

          {/* Issued Credentials */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-900">
              📤 발급한 자격증명 ({issuedCredentials.length})
            </h3>
            {issuedCredentials.length === 0 ? (
              <p className="text-sm text-gray-500">
                아직 발급한 자격증명이 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {issuedCredentials.map((vc) => (
                  <CredentialCard
                    key={vc.id}
                    credential={vc}
                    showRevoke
                    onRevoke={() => handleRevoke(vc.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Issue Tab */}
      {activeTab === "issue" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              수신자 DID (Subject)
            </label>
            <input
              type="text"
              placeholder="did:ethr:0x..."
              value={subjectDid}
              onChange={(e) => setSubjectDid(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              자격증명 타입
            </label>
            <select
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {CREDENTIAL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              클레임 추가
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                placeholder="키 (예: degree)"
                value={claimKey}
                onChange={(e) => setClaimKey(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="값 (예: 컴퓨터공학)"
                value={claimValue}
                onChange={(e) => setClaimValue(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={handleAddClaim}
                className="rounded-md bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700"
              >
                추가
              </button>
            </div>
            {Object.entries(claims).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(claims).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
                  >
                    {key}: {value}
                    <button
                      onClick={() => handleRemoveClaim(key)}
                      className="ml-1 text-blue-500 hover:text-blue-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              유효기간 (일)
            </label>
            <input
              type="number"
              min="0"
              value={expirationDays}
              onChange={(e) => setExpirationDays(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={handleIssue}
            disabled={loading || !address}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? "발급 중..." : "자격증명 발급 (서명 필요)"}
          </button>
        </div>
      )}

      {/* Verify Tab */}
      {activeTab === "verify" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              자격증명 ID
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                placeholder="urn:uuid:..."
                value={verifyId}
                onChange={(e) => setVerifyId(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={handleVerify}
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                검증
              </button>
            </div>
          </div>

          {verifyResult && (
            <div
              className={`rounded-md p-4 ${
                verifyResult.valid ? "bg-green-50" : "bg-red-50"
              }`}
            >
              <h4
                className={`font-medium ${
                  verifyResult.valid ? "text-green-800" : "text-red-800"
                }`}
              >
                {verifyResult.valid ? "✅ 유효한 자격증명" : "❌ 유효하지 않음"}
              </h4>
              <div className="mt-2 space-y-1 text-sm">
                <p>
                  서명:{" "}
                  {verifyResult.checks.signature ? "✓ 유효" : "✗ 유효하지 않음"}
                </p>
                <p>
                  만료: {verifyResult.checks.notExpired ? "✓ 유효" : "✗ 만료됨"}
                </p>
                <p>
                  폐기: {verifyResult.checks.notRevoked ? "✓ 유효" : "✗ 폐기됨"}
                </p>
              </div>
              {verifyResult.error && (
                <p className="mt-2 text-sm text-red-600">
                  오류: {verifyResult.error}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CredentialCard({
  credential,
  showRevoke,
  onRevoke,
}: {
  credential: VerifiableCredential;
  showRevoke?: boolean;
  onRevoke?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const credentialType = credential.type.find(
    (t) => t !== "VerifiableCredential"
  );
  const typeLabel =
    CREDENTIAL_TYPES.find((t) => t.value === credentialType)?.label ||
    credentialType;

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="inline-block rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
            {typeLabel}
          </span>
          <p className="mt-1 text-xs text-gray-500">
            발급일: {new Date(credential.issuanceDate).toLocaleDateString()}
            {credential.expirationDate && (
              <>
                {" "}
                | 만료:{" "}
                {new Date(credential.expirationDate).toLocaleDateString()}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {expanded ? "접기" : "상세"}
          </button>
          {showRevoke && onRevoke && (
            <button
              onClick={onRevoke}
              className="text-xs text-red-600 hover:text-red-800"
            >
              폐기
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 text-xs">
          <p>
            <strong>ID:</strong> {credential.id}
          </p>
          <p>
            <strong>발급자:</strong> {credential.issuer}
          </p>
          <p>
            <strong>수신자:</strong> {credential.credentialSubject.id}
          </p>
          <div>
            <strong>클레임:</strong>
            <pre className="mt-1 overflow-auto rounded bg-gray-100 p-2 text-xs">
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(credential.credentialSubject).filter(
                    ([k]) => k !== "id"
                  )
                ),
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
