/**
 * 05-delegation/index.ts
 *
 * DID 대리인 위임 예제
 * Owner가 Delegate에게 서명 권한을 위임하는 시나리오
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
  getSigner,
  getContract,
} from "../common/config.js";

// ========================================
// Types
// ========================================

interface DelegateInfo {
  delegateType: string;
  delegate: string;
  validTo: number;
}

// ========================================
// Delegate Functions
// ========================================

async function addDelegate(
  identity: string,
  delegateType: string,
  delegate: string,
  validity: number,
  signer: ethers.Wallet
): Promise<ethers.ContractTransactionReceipt | null> {
  const contract = getContract(signer);
  const delegateTypeBytes = ethers.encodeBytes32String(delegateType);
  const tx = await contract.addDelegate(
    identity,
    delegateTypeBytes,
    delegate,
    validity
  );
  return await tx.wait();
}

async function revokeDelegate(
  identity: string,
  delegateType: string,
  delegate: string,
  signer: ethers.Wallet
): Promise<ethers.ContractTransactionReceipt | null> {
  const contract = getContract(signer);
  const delegateTypeBytes = ethers.encodeBytes32String(delegateType);
  const tx = await contract.revokeDelegate(
    identity,
    delegateTypeBytes,
    delegate
  );
  return await tx.wait();
}

async function isValidDelegate(
  identity: string,
  delegateType: string,
  delegate: string
): Promise<boolean> {
  const contract = getContract();
  const delegateTypeBytes = ethers.encodeBytes32String(delegateType);
  return await contract.validDelegate(identity, delegateTypeBytes, delegate);
}

// ========================================
// Document Signing (with Delegate)
// ========================================

interface SignedDocument {
  document: {
    title: string;
    content: string;
    createdAt: string;
  };
  signature: {
    signer: string;
    onBehalfOf: string; // 대리 서명인 경우 원본 DID
    delegateType?: string;
    value: string;
  };
}

async function signAsDelegate(
  document: SignedDocument["document"],
  delegate: ethers.Wallet,
  identityDid: string,
  delegateType: string
): Promise<SignedDocument> {
  const documentString = JSON.stringify(document, Object.keys(document).sort());
  const signature = await delegate.signMessage(documentString);

  return {
    document,
    signature: {
      signer: addressToDid(delegate.address),
      onBehalfOf: identityDid,
      delegateType,
      value: signature,
    },
  };
}

async function verifyDelegateSignature(
  signedDocument: SignedDocument
): Promise<{
  valid: boolean;
  checks: {
    signatureValid: boolean;
    isValidDelegate: boolean;
  };
  recoveredAddress: string;
}> {
  const { document, signature } = signedDocument;

  try {
    const documentString = JSON.stringify(
      document,
      Object.keys(document).sort()
    );

    const recoveredAddress = ethers.verifyMessage(
      documentString,
      signature.value
    );

    const signerAddress = signature.signer.split(":").pop()!;
    const signatureValid =
      recoveredAddress.toLowerCase() === signerAddress.toLowerCase();

    // Delegate 권한 확인
    let isDelegateValid = false;
    if (signature.onBehalfOf && signature.delegateType) {
      const identityAddress = signature.onBehalfOf.split(":").pop()!;
      isDelegateValid = await isValidDelegate(
        identityAddress,
        signature.delegateType,
        signerAddress
      );
    }

    return {
      valid: signatureValid && isDelegateValid,
      checks: {
        signatureValid,
        isValidDelegate: isDelegateValid,
      },
      recoveredAddress,
    };
  } catch (error) {
    return {
      valid: false,
      checks: {
        signatureValid: false,
        isValidDelegate: false,
      },
      recoveredAddress: "",
    };
  }
}

// ========================================
// Main
// ========================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              👥 DID 대리인 위임 예제                           ║
║                                                               ║
║   시나리오: CEO가 비서에게 계약서 서명 권한을 위임              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // ========================================
  // 참여자 준비
  // ========================================
  logSection("참여자 준비");

  // CEO (DID 소유자) - Account #0
  const ceoPrivateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const ceo = getSigner(ceoPrivateKey);
  const ceoDid = addressToDid(ceo.address);

  // 비서 (대리인) - Account #1
  const secretaryPrivateKey =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const secretary = getSigner(secretaryPrivateKey);
  const secretaryDid = addressToDid(secretary.address);

  // 거래처 (검증자) - Account #2
  const partnerPrivateKey =
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
  const partner = getSigner(partnerPrivateKey);

  console.log("\n👥 참여자:");
  console.log(`   CEO (Owner): ${ceoDid.substring(0, 40)}...`);
  console.log(`   비서 (Delegate): ${secretaryDid.substring(0, 40)}...`);

  // ========================================
  // Part 1: 대리인 추가
  // ========================================
  logSection("Part 1: 대리인 추가");

  logStep(1, "CEO가 비서에게 서명 권한 위임");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  CEO: "비서에게 계약서 서명 권한을 위임합니다"                │
  │                                                             │
  │  • Delegate Type: sigAuth (서명 인증)                       │
  │  • 유효기간: 1시간                                          │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
  `);

  const delegateType = "sigAuth"; // 서명 인증용
  const validity = 3600; // 1시간

  try {
    const receipt = await addDelegate(
      ceo.address,
      delegateType,
      secretary.address,
      validity,
      ceo
    );

    logSuccess(`대리인 추가 완료! 블록: ${receipt?.blockNumber}`);

    // 이벤트 확인
    if (receipt?.logs) {
      const contract = getContract();
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed?.name === "DIDDelegateChanged") {
            logInfo(`📢 이벤트: DIDDelegateChanged`);
            logInfo(`   identity: ${parsed.args[0]}`);
            logInfo(
              `   delegateType: ${ethers.decodeBytes32String(parsed.args[1])}`
            );
            logInfo(`   delegate: ${parsed.args[2]}`);
            logInfo(
              `   validTo: ${new Date(
                Number(parsed.args[3]) * 1000
              ).toLocaleString()}`
            );
          }
        } catch {
          // 다른 이벤트 무시
        }
      }
    }
  } catch (error) {
    logError(`대리인 추가 실패: ${error}`);
    return;
  }

  // ========================================
  // Part 2: 대리인 권한 확인
  // ========================================
  logSection("Part 2: 대리인 권한 확인");

  logStep(2, "비서의 서명 권한 확인");

  const isValid = await isValidDelegate(
    ceo.address,
    delegateType,
    secretary.address
  );

  console.log(`\n🔍 권한 확인:`);
  console.log(`   CEO DID: ${ceoDid.substring(0, 40)}...`);
  console.log(`   비서 주소: ${secretary.address}`);
  console.log(`   권한 유형: ${delegateType}`);
  console.log(`   유효: ${isValid ? "✅" : "❌"}`);

  if (isValid) {
    logSuccess("비서는 CEO를 대신하여 서명할 수 있습니다!");
  }

  // ========================================
  // Part 3: 대리 서명
  // ========================================
  logSection("Part 3: 대리 서명");

  logStep(3, "비서가 CEO를 대신하여 계약서 서명");

  const contract_doc = {
    title: "공급 계약서",
    content: `
      제1조 (목적)
      본 계약은 갑(공급자)과 을(구매자) 간의 물품 공급에 관한 사항을 정함.
      
      제2조 (공급 물품)
      블록체인 서버 장비 100대
      
      제3조 (계약 금액)
      금 500,000,000원 (오억원)
    `.trim(),
    createdAt: new Date().toISOString(),
  };

  console.log(`\n📄 계약서 제목: ${contract_doc.title}`);

  const signedBySecretary = await signAsDelegate(
    contract_doc,
    secretary,
    ceoDid,
    delegateType
  );

  logSuccess("대리 서명 완료!");
  console.log(`   서명자: ${signedBySecretary.signature.signer}`);
  console.log(`   대리 서명: ${signedBySecretary.signature.onBehalfOf}`);
  console.log(
    `   서명값: ${signedBySecretary.signature.value.substring(0, 30)}...`
  );

  // ========================================
  // Part 4: 대리 서명 검증
  // ========================================
  logSection("Part 4: 대리 서명 검증");

  logStep(4, "거래처가 대리 서명 검증");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  거래처: "이 서명이 정말 CEO의 권한으로 된 건가요?"           │
  │                                                             │
  │  확인 사항:                                                  │
  │  1. 서명이 유효한가? (암호학적 검증)                         │
  │  2. 서명자가 CEO의 대리인인가? (블록체인 확인)               │
  └─────────────────────────────────────────────────────────────┘
  `);

  const verifyResult = await verifyDelegateSignature(signedBySecretary);

  console.log("\n🔍 검증 결과:");
  console.log(
    `   서명 유효: ${verifyResult.checks.signatureValid ? "✅" : "❌"}`
  );
  console.log(
    `   대리인 권한: ${verifyResult.checks.isValidDelegate ? "✅" : "❌"}`
  );
  console.log(`   복원된 서명자: ${verifyResult.recoveredAddress}`);

  if (verifyResult.valid) {
    logSuccess("\n✅ 대리 서명 검증 성공!");
    console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  🎉 검증 완료!                                               │
  │                                                             │
  │  이 계약서는 비서가 CEO를 대신하여 서명했으며,               │
  │  블록체인에서 비서의 대리 권한이 확인되었습니다.              │
  │                                                             │
  │  ✅ 암호학적 서명 검증 통과                                  │
  │  ✅ DID Registry에서 Delegate 권한 확인됨                   │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
    `);
  }

  // ========================================
  // Part 5: 권한 없는 자의 서명 시도
  // ========================================
  logSection("Part 5: 보안 테스트 - 권한 없는 자의 서명");

  logStep(5, "거래처 직원이 CEO 대신 서명 시도");

  const fakeSignature = await signAsDelegate(
    contract_doc,
    partner,
    ceoDid,
    delegateType
  );

  const fakeResult = await verifyDelegateSignature(fakeSignature);

  console.log("\n🔍 위조 서명 검증:");
  console.log(
    `   서명 유효: ${fakeResult.checks.signatureValid ? "✅" : "❌"}`
  );
  console.log(
    `   대리인 권한: ${
      fakeResult.checks.isValidDelegate ? "✅" : "❌ 권한 없음!"
    }`
  );

  if (!fakeResult.valid) {
    logSuccess("✅ 방어 성공! 대리 권한이 없는 자의 서명은 거부됩니다");
  }

  // ========================================
  // Part 6: 대리 권한 철회
  // ========================================
  logSection("Part 6: 대리 권한 철회");

  logStep(6, "CEO가 비서의 권한 철회");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  CEO: "비서의 서명 권한을 철회합니다"                        │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
  `);

  try {
    const revokeReceipt = await revokeDelegate(
      ceo.address,
      delegateType,
      secretary.address,
      ceo
    );

    logSuccess(`권한 철회 완료! 블록: ${revokeReceipt?.blockNumber}`);
  } catch (error) {
    logError(`권한 철회 실패: ${error}`);
  }

  // 철회 후 권한 확인
  logStep(7, "철회 후 권한 확인");

  const isStillValid = await isValidDelegate(
    ceo.address,
    delegateType,
    secretary.address
  );

  console.log(`\n🔍 권한 확인:`);
  console.log(`   유효: ${isStillValid ? "✅" : "❌ 철회됨"}`);

  if (!isStillValid) {
    logSuccess("비서의 서명 권한이 성공적으로 철회되었습니다!");
  }

  // 철회 후 서명 검증
  logStep(8, "철회 후 새 서명 검증");

  const newDoc = {
    ...contract_doc,
    createdAt: new Date().toISOString(),
  };

  const signedAfterRevoke = await signAsDelegate(
    newDoc,
    secretary,
    ceoDid,
    delegateType
  );

  const revokedResult = await verifyDelegateSignature(signedAfterRevoke);

  console.log("\n🔍 철회 후 서명 검증:");
  console.log(
    `   대리인 권한: ${
      revokedResult.checks.isValidDelegate ? "✅" : "❌ 권한 없음!"
    }`
  );

  if (!revokedResult.valid) {
    logSuccess("✅ 철회된 대리인의 서명은 더 이상 유효하지 않습니다!");
  }

  // ========================================
  // Summary
  // ========================================
  logSection("📚 학습 요약");
  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                      대리인 위임                             │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  1. 대리인 추가 (addDelegate)                               │
  │     • Owner가 특정 주소에 권한 부여                         │
  │     • delegateType: sigAuth (서명), veriKey (검증) 등      │
  │     • 유효기간 설정 가능                                    │
  │                                                             │
  │  2. 대리 서명                                               │
  │     • Delegate가 Identity를 대신하여 서명                   │
  │     • 서명에 "누구를 대신하는지" 명시                       │
  │                                                             │
  │  3. 검증                                                    │
  │     • 서명 자체의 유효성 검증                               │
  │     • 블록체인에서 Delegate 권한 확인                       │
  │                                                             │
  │  4. 권한 철회 (revokeDelegate)                              │
  │     • Owner가 언제든 권한 철회 가능                         │
  │     • 철회 후 서명은 더 이상 유효하지 않음                   │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  💡 사용 사례:
  
  ✅ 기업 대표 → 비서에게 계약서 서명 권한 위임
  ✅ 부모 → 보호자에게 의료 동의서 서명 권한 위임
  ✅ 법인 → 이사에게 특정 업무 서명 권한 위임
  ✅ 서버 → 서명 키 교체 시 임시 위임

  🎉 대리인 위임 예제 완료!
  
  다음 예제: 06-revocation (VC 폐기)
  `);
}

main().catch(console.error);
