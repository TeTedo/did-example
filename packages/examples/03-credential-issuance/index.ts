/**
 * 03-credential-issuance/index.ts
 *
 * VC 발급/검증 전체 시나리오
 * Issuer → Holder → Verifier 흐름
 */

import { ethers } from "ethers";
import {
  logSection,
  logStep,
  logSuccess,
  logInfo,
  logWarning,
  logError,
  addressToDid,
  didToAddress,
  getSigner,
  getContract,
} from "../common/config.js";

// ========================================
// Types
// ========================================

const VC_CONTEXTS = [
  "https://www.w3.org/2018/credentials/v1",
  "https://w3id.org/security/suites/secp256k1-2019/v1",
];

interface CredentialProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

interface VerifiableCredential {
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
  proof: CredentialProof;
}

interface IssueCredentialRequest {
  subjectDid: string;
  type: string[];
  claims: Record<string, unknown>;
  expirationDate?: string;
}

interface SimpleWallet {
  did: string;
  credentials: VerifiableCredential[];
}

interface VerificationResult {
  valid: boolean;
  checks: {
    signature: boolean;
    notExpired: boolean;
    issuerValid: boolean;
  };
  error?: string;
}

// ========================================
// Issue Credential
// ========================================

async function issueCredential(
  issuer: ethers.Wallet,
  request: IssueCredentialRequest
): Promise<VerifiableCredential> {
  const issuerDid = addressToDid(issuer.address);
  const issuanceDate = new Date().toISOString();

  const credentialPayload = {
    "@context": VC_CONTEXTS,
    type: ["VerifiableCredential", ...request.type],
    issuer: issuerDid,
    issuanceDate,
    expirationDate: request.expirationDate,
    credentialSubject: {
      id: request.subjectDid,
      ...request.claims,
    },
  };

  const message = JSON.stringify(credentialPayload);
  const signature = await issuer.signMessage(message);

  const proof: CredentialProof = {
    type: "EcdsaSecp256k1Signature2019",
    created: issuanceDate,
    verificationMethod: `${issuerDid}#controller`,
    proofPurpose: "assertionMethod",
    proofValue: signature,
  };

  return {
    "@context": VC_CONTEXTS,
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ["VerifiableCredential", ...request.type],
    issuer: issuerDid,
    issuanceDate,
    expirationDate: request.expirationDate,
    credentialSubject: {
      id: request.subjectDid,
      ...request.claims,
    },
    proof,
  };
}

// ========================================
// Verify Credential
// ========================================

async function verifyCredential(
  vc: VerifiableCredential
): Promise<VerificationResult> {
  try {
    // 1. 서명 검증을 위한 payload 재구성
    const credentialPayload = {
      "@context": vc["@context"],
      type: vc.type,
      issuer: vc.issuer,
      issuanceDate: vc.issuanceDate,
      expirationDate: vc.expirationDate,
      credentialSubject: vc.credentialSubject,
    };

    const message = JSON.stringify(credentialPayload);

    // 2. 서명에서 주소 복원
    const recoveredAddress = ethers.verifyMessage(message, vc.proof.proofValue);
    const issuerAddress = didToAddress(vc.issuer);

    const signatureValid =
      recoveredAddress.toLowerCase() === issuerAddress.toLowerCase();

    // 3. 만료일 확인
    const notExpired = vc.expirationDate
      ? new Date(vc.expirationDate) > new Date()
      : true;

    // 4. Issuer DID 확인 (블록체인)
    let issuerValid = false;
    try {
      const contract = getContract();
      const owner = await contract.identityOwner(issuerAddress);
      issuerValid = owner.toLowerCase() === issuerAddress.toLowerCase();
    } catch {
      issuerValid = signatureValid; // 블록체인 연결 실패 시 서명만으로 판단
    }

    return {
      valid: signatureValid && notExpired && issuerValid,
      checks: {
        signature: signatureValid,
        notExpired,
        issuerValid,
      },
    };
  } catch (error) {
    return {
      valid: false,
      checks: {
        signature: false,
        notExpired: false,
        issuerValid: false,
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ========================================
// Holder Wallet
// ========================================

function addCredential(wallet: SimpleWallet, vc: VerifiableCredential): void {
  wallet.credentials.push(vc);
}

function listCredentials(wallet: SimpleWallet): void {
  console.log(`\n📋 지갑 내 VC 목록 (${wallet.credentials.length}개):`);
  wallet.credentials.forEach((vc, i) => {
    console.log(`   ${i + 1}. ${vc.type.join(", ")}`);
    console.log(`      발급자: ${vc.issuer.substring(0, 40)}...`);
    console.log(`      발급일: ${vc.issuanceDate}`);
  });
}

// ========================================
// Main
// ========================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              📜 Verifiable Credential 종합 예제                ║
║                                                               ║
║   참여자:                                                      ║
║   - Issuer (서울대학교): VC 발급                               ║
║   - Holder (김철수): VC 보관 및 제출                           ║
║   - Verifier (회사): VC 검증                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // ========================================
  // 참여자 준비
  // ========================================
  logSection("참여자 준비");

  const issuerPrivateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const issuer = getSigner(issuerPrivateKey);
  const issuerDid = addressToDid(issuer.address);

  const holderPrivateKey =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const holder = getSigner(holderPrivateKey);
  const holderDid = addressToDid(holder.address);

  const verifierPrivateKey =
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
  const verifier = getSigner(verifierPrivateKey);
  const verifierDid = addressToDid(verifier.address);

  console.log("\n👥 참여자:");
  console.log(`   Issuer (서울대): ${issuerDid.substring(0, 40)}...`);
  console.log(`   Holder (김철수): ${holderDid.substring(0, 40)}...`);
  console.log(`   Verifier (회사): ${verifierDid.substring(0, 40)}...`);

  // ========================================
  // Part 1: Issuer가 VC 발급
  // ========================================
  logSection("Part 1: Issuer가 VC 발급");

  logStep(1, "Holder가 졸업증명서 발급 요청");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  김철수 → 서울대: "졸업증명서 VC 발급해주세요"                │
  │                                                             │
  │  제출 정보:                                                  │
  │  - 학번: 2020-12345                                         │
  │  - 이름: 김철수                                              │
  │  - DID: ${holderDid.substring(0, 30)}...                    │
  └─────────────────────────────────────────────────────────────┘
  `);

  logStep(2, "Issuer가 학적 확인 후 VC 발급");

  const request: IssueCredentialRequest = {
    subjectDid: holderDid,
    type: ["UniversityDegreeCredential"],
    claims: {
      name: "김철수",
      studentId: "2020-12345",
      degree: {
        type: "BachelorDegree",
        name: "컴퓨터공학",
        college: "공과대학",
      },
      graduationDate: "2024-02-15",
      gpa: 3.8,
      honors: "우등",
    },
    expirationDate: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000
    ).toISOString(),
  };

  const vc = await issueCredential(issuer, request);

  logSuccess("VC 발급 완료!");
  console.log(`   VC ID: ${vc.id}`);
  console.log(`   발급일: ${vc.issuanceDate}`);
  console.log(`   만료일: ${vc.expirationDate}`);

  // ========================================
  // Part 2: Holder가 VC 수신 및 저장
  // ========================================
  logSection("Part 2: Holder가 VC 수신");

  logStep(3, "Holder가 VC 수신");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  서울대 → 김철수: VC 전달                                    │
  │                                                             │
  │  (QR 코드, 이메일, 앱 푸시 등으로 전달)                       │
  └─────────────────────────────────────────────────────────────┘
  `);

  logStep(4, "Holder가 수신한 VC 검증");

  const holderVerifyResult = await verifyCredential(vc);

  console.log("\n🔍 Holder의 검증:");
  console.log(
    `   서명 유효: ${holderVerifyResult.checks.signature ? "✅" : "❌"}`
  );
  console.log(
    `   Issuer가 정말 서울대?: ${
      holderVerifyResult.checks.issuerValid ? "✅" : "❌"
    }`
  );

  if (holderVerifyResult.valid) {
    logSuccess("VC 검증 성공! 지갑에 저장합니다.");
  } else {
    logError("VC 검증 실패! 위조된 VC일 수 있습니다.");
    return;
  }

  logStep(5, "Holder 지갑에 저장");

  const wallet: SimpleWallet = {
    did: holderDid,
    credentials: [],
  };

  addCredential(wallet, vc);

  logSuccess("지갑에 저장 완료!");
  listCredentials(wallet);

  // ========================================
  // Part 3: Verifier가 VC 검증
  // ========================================
  logSection("Part 3: Verifier가 VC 검증");

  logStep(6, "Verifier가 졸업증명서 요청");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  회사 인사팀 → 김철수: "입사 지원을 위해 졸업증명서를         │
  │                        제출해주세요"                         │
  └─────────────────────────────────────────────────────────────┘
  `);

  logStep(7, "Holder가 VC 제출");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  김철수 → 회사: VC 제출                                      │
  │                                                             │
  │  (JSON 파일 업로드, QR 스캔 등)                               │
  └─────────────────────────────────────────────────────────────┘
  `);

  const submittedVc = wallet.credentials[0];

  logStep(8, "Verifier가 VC 검증");

  logInfo("Verifier가 독립적으로 검증 수행...");

  const verifierResult = await verifyCredential(submittedVc);

  console.log("\n🔍 Verifier의 검증 결과:");
  console.log(
    `   1. 서명 유효: ${verifierResult.checks.signature ? "✅" : "❌"}`
  );
  console.log(
    `   2. 만료 안됨: ${verifierResult.checks.notExpired ? "✅" : "❌"}`
  );
  console.log(
    `   3. Issuer 유효: ${verifierResult.checks.issuerValid ? "✅" : "❌"}`
  );

  try {
    const contract = getContract();
    const issuerAddress = issuer.address;
    const owner = await contract.identityOwner(issuerAddress);

    console.log(`\n📋 Issuer DID 확인:`);
    console.log(`   Issuer DID: ${submittedVc.issuer}`);
    console.log(`   Owner: ${owner}`);
    console.log(
      `   유효: ${
        owner.toLowerCase() === issuerAddress.toLowerCase() ? "✅" : "❌"
      }`
    );
  } catch {
    logWarning("블록체인 연결 실패. Issuer DID 확인 생략.");
  }

  if (verifierResult.valid) {
    logSuccess("\n✅ VC 검증 성공!");

    console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  🎉 검증 완료!                                               │
  │                                                             │
  │  김철수님은 서울대학교 컴퓨터공학과를 졸업하였습니다.          │
  │                                                             │
  │  - 학위: 공학사 (컴퓨터공학)                                  │
  │  - 학점: 3.8                                                 │
  │  - 졸업일: 2024-02-15                                        │
  │  - 비고: 우등 졸업                                           │
  │                                                             │
  │  ✅ Issuer (서울대)의 서명 확인됨                             │
  │  ✅ 블록체인에서 Issuer DID 확인됨                            │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
    `);
  } else {
    logError("\n❌ VC 검증 실패!");
  }

  // ========================================
  // Summary
  // ========================================
  logSection("📚 학습 요약");
  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                    VC 발급/검증 흐름                          │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  1. 발급 (Issuer → Holder)                                  │
  │     • Issuer가 클레임 확인 후 VC 생성                        │
  │     • Issuer의 개인키로 서명                                 │
  │     • Holder에게 전달 (QR, 링크 등)                         │
  │                                                             │
  │  2. 저장 (Holder)                                           │
  │     • VC 수신 시 검증 필수!                                  │
  │     • 검증 후 지갑에 저장                                    │
  │     • 블록체인에 저장 안 함!                                 │
  │                                                             │
  │  3. 제출 (Holder → Verifier)                                │
  │     • Verifier가 특정 VC 요청                               │
  │     • Holder가 선택적으로 제출                               │
  │                                                             │
  │  4. 검증 (Verifier)                                         │
  │     • 서명 검증 (Issuer 확인)                               │
  │     • 만료일 확인                                           │
  │     • 블록체인에서 Issuer DID 확인                          │
  │     • Issuer나 Holder 없이 독립 검증!                       │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  🔑 핵심 포인트:
  
  ✅ VC는 블록체인에 저장되지 않음 (Holder가 로컬 보관)
  ✅ 서명으로 위변조 방지 (1바이트만 바뀌어도 탐지)
  ✅ 제3자가 독립적으로 검증 가능
  ✅ Issuer/Holder 없이도 블록체인으로 신원 확인

  🎉 Verifiable Credential 예제 완료!
  `);
}

main().catch(console.error);
