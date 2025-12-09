/**
 * 06-revocation/index.ts
 *
 * VC 폐기(Revocation) 예제
 * Issuer가 발급한 VC를 무효화하는 시나리오
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

interface CredentialStatus {
  id: string;
  type: string;
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
  credentialStatus?: CredentialStatus;
  proof: CredentialProof;
}

// ========================================
// In-Memory Revocation Registry (Simple)
// ========================================

// 실제로는 블록체인이나 외부 저장소에 저장
const revocationRegistry = new Map<
  string,
  { revokedAt: string; reason: string }
>();

function revokeCredential(credentialId: string, reason: string): void {
  revocationRegistry.set(credentialId, {
    revokedAt: new Date().toISOString(),
    reason,
  });
}

function isRevoked(credentialId: string): {
  revoked: boolean;
  info?: { revokedAt: string; reason: string };
} {
  const info = revocationRegistry.get(credentialId);
  return info ? { revoked: true, info } : { revoked: false };
}

// ========================================
// On-Chain Revocation (Using setAttribute)
// ========================================

async function revokeCredentialOnChain(
  issuer: ethers.Wallet,
  credentialId: string,
  reason: string
): Promise<ethers.ContractTransactionReceipt | null> {
  const contract = getContract(issuer);

  // Attribute name: did/revoked/{credentialId}
  const attrName = ethers.encodeBytes32String("did/revoked");
  const attrValue = ethers.toUtf8Bytes(
    JSON.stringify({
      credentialId,
      reason,
      revokedAt: new Date().toISOString(),
    })
  );

  // validTo = 0으로 설정하면 즉시 만료 (폐기 표시)
  // 여기서는 1초로 설정하여 기록만 남김
  const tx = await contract.setAttribute(
    issuer.address,
    attrName,
    attrValue,
    1 // 1초 후 만료 (폐기 기록용)
  );

  return await tx.wait();
}

async function checkOnChainRevocation(
  issuerAddress: string
): Promise<{ credentialId: string; reason: string; revokedAt: string }[]> {
  const contract = getContract();

  // DIDAttributeChanged 이벤트 조회
  const filter = contract.filters.DIDAttributeChanged(issuerAddress);
  const events = await contract.queryFilter(filter, 0, "latest");

  const revocations: {
    credentialId: string;
    reason: string;
    revokedAt: string;
  }[] = [];

  for (const event of events) {
    if ("args" in event && event.args) {
      try {
        const name = ethers.decodeBytes32String(event.args[1]);
        if (name === "did/revoked") {
          const value = ethers.toUtf8String(event.args[2]);
          const data = JSON.parse(value);
          revocations.push(data);
        }
      } catch {
        // 파싱 실패 무시
      }
    }
  }

  return revocations;
}

// ========================================
// VC Functions
// ========================================

async function issueCredential(
  issuer: ethers.Wallet,
  subjectDid: string,
  claims: Record<string, unknown>
): Promise<VerifiableCredential> {
  const issuerDid = addressToDid(issuer.address);
  const issuanceDate = new Date().toISOString();
  const credentialId = `urn:uuid:${crypto.randomUUID()}`;

  const credentialPayload = {
    "@context": VC_CONTEXTS,
    type: ["VerifiableCredential", "ProfessionalLicenseCredential"],
    issuer: issuerDid,
    issuanceDate,
    credentialSubject: {
      id: subjectDid,
      ...claims,
    },
    credentialStatus: {
      id: `https://issuer.example.com/credentials/status/${credentialId}`,
      type: "RevocationList2020",
    },
  };

  const message = JSON.stringify(credentialPayload);
  const signature = await issuer.signMessage(message);

  return {
    "@context": VC_CONTEXTS,
    id: credentialId,
    type: ["VerifiableCredential", "ProfessionalLicenseCredential"],
    issuer: issuerDid,
    issuanceDate,
    credentialSubject: {
      id: subjectDid,
      ...claims,
    },
    credentialStatus: {
      id: `https://issuer.example.com/credentials/status/${credentialId}`,
      type: "RevocationList2020",
    },
    proof: {
      type: "EcdsaSecp256k1Signature2019",
      created: issuanceDate,
      verificationMethod: `${issuerDid}#controller`,
      proofPurpose: "assertionMethod",
      proofValue: signature,
    },
  };
}

async function verifyCredentialWithRevocation(
  vc: VerifiableCredential,
  checkOnChain: boolean = false
): Promise<{
  valid: boolean;
  checks: {
    signature: boolean;
    notExpired: boolean;
    notRevoked: boolean;
  };
  revocationInfo?: { revokedAt: string; reason: string };
}> {
  // 1. 서명 검증
  const credentialPayload = {
    "@context": vc["@context"],
    type: vc.type,
    issuer: vc.issuer,
    issuanceDate: vc.issuanceDate,
    credentialSubject: vc.credentialSubject,
    credentialStatus: vc.credentialStatus,
  };

  const message = JSON.stringify(credentialPayload);
  let signatureValid = false;

  try {
    const recoveredAddress = ethers.verifyMessage(message, vc.proof.proofValue);
    const issuerAddress = didToAddress(vc.issuer);
    signatureValid =
      recoveredAddress.toLowerCase() === issuerAddress.toLowerCase();
  } catch {
    signatureValid = false;
  }

  // 2. 만료 확인
  const notExpired = vc.expirationDate
    ? new Date(vc.expirationDate) > new Date()
    : true;

  // 3. 폐기 확인
  let notRevoked = true;
  let revocationInfo: { revokedAt: string; reason: string } | undefined;

  // In-memory 확인
  const revStatus = isRevoked(vc.id);
  if (revStatus.revoked) {
    notRevoked = false;
    revocationInfo = revStatus.info;
  }

  // On-chain 확인 (선택적)
  if (checkOnChain && notRevoked) {
    try {
      const issuerAddress = didToAddress(vc.issuer);
      const onChainRevocations = await checkOnChainRevocation(issuerAddress);
      const found = onChainRevocations.find((r) => r.credentialId === vc.id);
      if (found) {
        notRevoked = false;
        revocationInfo = { revokedAt: found.revokedAt, reason: found.reason };
      }
    } catch {
      // 블록체인 조회 실패 시 무시
    }
  }

  return {
    valid: signatureValid && notExpired && notRevoked,
    checks: {
      signature: signatureValid,
      notExpired,
      notRevoked,
    },
    revocationInfo,
  };
}

// ========================================
// Main
// ========================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              🚫 VC 폐기(Revocation) 예제                       ║
║                                                               ║
║   시나리오: 의사 면허 발급 후, 자격 박탈로 인한 폐기            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // ========================================
  // 참여자 준비
  // ========================================
  logSection("참여자 준비");

  // 대한의사협회 (Issuer) - Account #0
  const issuerPrivateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const issuer = getSigner(issuerPrivateKey);
  const issuerDid = addressToDid(issuer.address);

  // 의사 (Holder) - Account #1
  const doctorPrivateKey =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const doctor = getSigner(doctorPrivateKey);
  const doctorDid = addressToDid(doctor.address);

  // 병원 (Verifier) - Account #2
  const hospitalPrivateKey =
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
  const hospital = getSigner(hospitalPrivateKey);

  console.log("\n👥 참여자:");
  console.log(`   대한의사협회 (Issuer): ${issuerDid.substring(0, 40)}...`);
  console.log(`   김의사 (Holder): ${doctorDid.substring(0, 40)}...`);

  // ========================================
  // Part 1: 의사 면허 발급
  // ========================================
  logSection("Part 1: 의사 면허 발급");

  logStep(1, "대한의사협회가 의사 면허 VC 발급");

  const licenseVc = await issueCredential(issuer, doctorDid, {
    name: "김의사",
    licenseNumber: "MD-2024-12345",
    specialty: "내과",
    issuedDate: "2024-01-15",
    validUntil: "2029-01-14",
  });

  logSuccess("의사 면허 발급 완료!");
  console.log(`   VC ID: ${licenseVc.id}`);
  console.log(`   면허번호: ${licenseVc.credentialSubject.licenseNumber}`);
  console.log(`   전문과목: ${licenseVc.credentialSubject.specialty}`);

  // ========================================
  // Part 2: 면허 검증 (정상)
  // ========================================
  logSection("Part 2: 면허 검증 (정상 상태)");

  logStep(2, "병원에서 김의사 면허 검증");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  병원: "김의사님, 면허 확인이 필요합니다"                     │
  │                                                             │
  │  김의사: (VC 제출)                                           │
  └─────────────────────────────────────────────────────────────┘
  `);

  const initialVerify = await verifyCredentialWithRevocation(licenseVc);

  console.log("\n🔍 검증 결과:");
  console.log(`   서명 유효: ${initialVerify.checks.signature ? "✅" : "❌"}`);
  console.log(`   만료 안됨: ${initialVerify.checks.notExpired ? "✅" : "❌"}`);
  console.log(`   폐기 안됨: ${initialVerify.checks.notRevoked ? "✅" : "❌"}`);

  if (initialVerify.valid) {
    logSuccess("\n✅ 면허 검증 성공! 진료 가능합니다.");
  }

  // ========================================
  // Part 3: 자격 박탈로 인한 면허 폐기
  // ========================================
  logSection("Part 3: 면허 폐기");

  logStep(3, "대한의사협회에서 면허 폐기 처리");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  ⚠️ 의료법 위반으로 인한 면허 취소                           │
  │                                                             │
  │  사유: 의료법 제66조 위반                                    │
  │  처분일: ${new Date().toISOString().split("T")[0]}          │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
  `);

  // Off-chain 폐기 (빠른 처리)
  revokeCredential(licenseVc.id, "의료법 제66조 위반 - 면허 취소");
  logSuccess("폐기 처리 완료! (Off-chain)");

  // On-chain 폐기 (영구 기록)
  logStep(4, "블록체인에 폐기 기록 저장");

  try {
    const receipt = await revokeCredentialOnChain(
      issuer,
      licenseVc.id,
      "의료법 제66조 위반 - 면허 취소"
    );

    logSuccess(`블록체인 기록 완료! 블록: ${receipt?.blockNumber}`);

    // 이벤트 확인
    if (receipt?.logs) {
      const contract = getContract();
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed?.name === "DIDAttributeChanged") {
            logInfo(`📢 이벤트: DIDAttributeChanged`);
            logInfo(`   폐기 기록이 블록체인에 영구 저장됨`);
          }
        } catch {
          // 무시
        }
      }
    }
  } catch (error) {
    logWarning(`블록체인 기록 실패: ${error}`);
    logInfo("Off-chain 폐기 상태는 유지됩니다.");
  }

  // ========================================
  // Part 4: 폐기 후 검증
  // ========================================
  logSection("Part 4: 폐기 후 검증");

  logStep(5, "병원에서 김의사 면허 재검증");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  병원: "김의사님, 면허 확인이 필요합니다"                     │
  │                                                             │
  │  김의사: (동일한 VC 제출)                                    │
  └─────────────────────────────────────────────────────────────┘
  `);

  const afterRevokeVerify = await verifyCredentialWithRevocation(
    licenseVc,
    true
  );

  console.log("\n🔍 검증 결과:");
  console.log(
    `   서명 유효: ${afterRevokeVerify.checks.signature ? "✅" : "❌"}`
  );
  console.log(
    `   만료 안됨: ${afterRevokeVerify.checks.notExpired ? "✅" : "❌"}`
  );
  console.log(
    `   폐기 안됨: ${afterRevokeVerify.checks.notRevoked ? "✅" : "❌ 폐기됨!"}`
  );

  if (afterRevokeVerify.revocationInfo) {
    console.log(`\n⚠️ 폐기 정보:`);
    console.log(`   폐기 일시: ${afterRevokeVerify.revocationInfo.revokedAt}`);
    console.log(`   폐기 사유: ${afterRevokeVerify.revocationInfo.reason}`);
  }

  if (!afterRevokeVerify.valid) {
    logError("\n❌ 면허 검증 실패! 이 면허는 폐기되었습니다.");
    console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  🚫 진료 불가                                                │
  │                                                             │
  │  이 의사의 면허는 폐기되었습니다.                             │
  │  대한의사협회에 문의하세요.                                   │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
    `);
  }

  // ========================================
  // Part 5: 보안 테스트 - 서명은 유효하지만 폐기됨
  // ========================================
  logSection("Part 5: 보안 분석");

  logStep(6, "폐기된 VC의 특성");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                      폐기된 VC 특성                           │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  ✅ 서명은 여전히 유효                                       │
  │     └── VC 자체는 변조되지 않음                              │
  │     └── Issuer가 발급한 것이 맞음                            │
  │                                                             │
  │  ❌ 하지만 폐기 상태                                         │
  │     └── Revocation Registry에 등록됨                        │
  │     └── 더 이상 유효하지 않음                                │
  │                                                             │
  │  💡 핵심:                                                    │
  │     폐기 확인은 서명 검증과 별개의 단계!                      │
  │     반드시 Issuer의 폐기 목록을 확인해야 함                   │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
  `);

  // ========================================
  // Part 6: 블록체인 폐기 기록 조회
  // ========================================
  logSection("Part 6: 블록체인 폐기 기록 조회");

  logStep(7, "영구 폐기 기록 확인");

  try {
    const revocations = await checkOnChainRevocation(issuer.address);

    console.log(`\n📋 대한의사협회의 폐기 기록 (${revocations.length}건):`);
    for (const rev of revocations) {
      console.log(`\n   📜 VC ID: ${rev.credentialId.substring(0, 30)}...`);
      console.log(`      폐기 일시: ${rev.revokedAt}`);
      console.log(`      폐기 사유: ${rev.reason}`);
    }

    logSuccess("블록체인에서 폐기 기록이 영구 보존됩니다!");
  } catch (error) {
    logWarning("블록체인 조회 실패");
  }

  // ========================================
  // Summary
  // ========================================
  logSection("📚 학습 요약");
  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                       VC 폐기                                │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  1. 왜 폐기가 필요한가?                                      │
  │     • 자격 취소 (면허 박탈, 자격증 취소)                      │
  │     • 오발급 정정                                            │
  │     • 유효기간 전 조기 만료                                   │
  │                                                             │
  │  2. 폐기 방법                                                │
  │                                                             │
  │     Off-chain (빠름, 저렴)                                   │
  │     ┌─────────────────────────────────────────┐             │
  │     │  Revocation Registry 서버                 │             │
  │     │  • 빠른 조회                              │             │
  │     │  • 비용 없음                              │             │
  │     │  • 중앙화 위험                            │             │
  │     └─────────────────────────────────────────┘             │
  │                                                             │
  │     On-chain (영구, 신뢰)                                    │
  │     ┌─────────────────────────────────────────┐             │
  │     │  블록체인 기록 (setAttribute)             │             │
  │     │  • 영구 보존                              │             │
  │     │  • 위변조 불가                            │             │
  │     │  • 가스비 필요                            │             │
  │     └─────────────────────────────────────────┘             │
  │                                                             │
  │  3. 검증 흐름                                                │
  │     서명 검증 → 만료 확인 → 폐기 확인                        │
  │     (모두 통과해야 유효!)                                    │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  💡 실제 서비스 권장 사항:
  
  ✅ Off-chain: 실시간 상태 확인용
  ✅ On-chain: 영구 기록 및 법적 증거용
  ✅ 두 가지 병행 사용 권장

  🎉 VC 폐기 예제 완료!
  `);
}

main().catch(console.error);
