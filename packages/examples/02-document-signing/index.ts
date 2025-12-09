/**
 * 02-document-signing/index.ts
 *
 * 전자문서 서명 전체 예제
 */

import { ethers } from "ethers";
import {
  logSection,
  logStep,
  logSuccess,
  logInfo,
  logWarning,
  addressToDid,
  getSigner,
  getContract,
} from "../common/config.js";

// ========================================
// Types
// ========================================

interface SignedDocument {
  document: {
    title: string;
    content: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  };
  signature: {
    signer: string;
    signerAddress: string;
    algorithm: string;
    created: string;
    value: string;
  };
}

// ========================================
// Sign Document
// ========================================

async function signDocument(
  document: SignedDocument["document"],
  signer: ethers.Wallet
): Promise<SignedDocument> {
  const documentString = JSON.stringify(document, Object.keys(document).sort());
  const signature = await signer.signMessage(documentString);

  return {
    document,
    signature: {
      signer: addressToDid(signer.address),
      signerAddress: signer.address,
      algorithm: "EcdsaSecp256k1Signature2019",
      created: new Date().toISOString(),
      value: signature,
    },
  };
}

// ========================================
// Verify Signature
// ========================================

interface VerificationResult {
  valid: boolean;
  checks: {
    signatureValid: boolean;
    signerMatch: boolean;
    documentIntact: boolean;
    signerIsOwner?: boolean;
  };
  recoveredAddress: string;
  declaredSigner: string;
  error?: string;
}

async function verifySignature(
  signedDocument: SignedDocument
): Promise<VerificationResult> {
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

    const signerMatch =
      recoveredAddress.toLowerCase() === signature.signerAddress.toLowerCase();

    let signerIsOwner: boolean | undefined;
    try {
      const contract = getContract();
      const owner = await contract.identityOwner(signature.signerAddress);
      signerIsOwner =
        owner.toLowerCase() === signature.signerAddress.toLowerCase();
    } catch {
      signerIsOwner = undefined;
    }

    return {
      valid: signerMatch,
      checks: {
        signatureValid: true,
        signerMatch,
        documentIntact: true,
        signerIsOwner,
      },
      recoveredAddress,
      declaredSigner: signature.signerAddress,
    };
  } catch (error) {
    return {
      valid: false,
      checks: {
        signatureValid: false,
        signerMatch: false,
        documentIntact: false,
      },
      recoveredAddress: "",
      declaredSigner: signature.signerAddress,
      error: error instanceof Error ? error.message : "Unknown error",
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
║              📝 전자문서 서명 종합 예제                         ║
║                                                               ║
║   이 예제에서 배우는 것:                                        ║
║   1. 문서에 서명하기                                           ║
║   2. 서명 검증하기                                             ║
║   3. 위변조 탐지                                               ║
║   4. 다른 사람이 서명한 문서 검증                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // ========================================
  // Part 1: 문서 서명
  // ========================================
  logSection("Part 1: 문서 서명");

  const privateKey0 =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const signer0 = getSigner(privateKey0);

  logStep(1, "문서 생성");
  const document = {
    title: "주식 양도 계약서",
    content: `
      양도인 (갑)과 양수인 (을)은 다음과 같이 주식 양도 계약을 체결한다.
      
      제1조 (양도 주식)
      갑은 보유한 ㈜블록체인테크 보통주 1,000주를 을에게 양도한다.
      
      제2조 (양도 대금)
      양도 대금은 금 100,000,000원 (일억원)으로 한다.
      
      제3조 (양도일)
      양도일은 2024년 1월 15일로 한다.
    `.trim(),
    createdAt: new Date().toISOString(),
    metadata: {
      documentType: "stock_transfer_agreement",
      parties: {
        transferor: addressToDid(signer0.address),
        transferee: "did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      },
    },
  };

  console.log(`\n📄 문서 제목: ${document.title}`);
  console.log(`   생성 시간: ${document.createdAt}`);

  logStep(2, "갑(양도인)이 서명");
  const signedByTransferor = await signDocument(document, signer0);

  logSuccess(`서명 완료!`);
  console.log(`   서명자: ${signedByTransferor.signature.signer}`);
  console.log(
    `   서명값: ${signedByTransferor.signature.value.substring(0, 30)}...`
  );

  // ========================================
  // Part 2: 서명 검증
  // ========================================
  logSection("Part 2: 서명 검증");

  logStep(3, "제3자가 서명 검증");
  const verifyResult = await verifySignature(signedByTransferor);

  console.log("\n🔍 검증 결과:");
  console.log(
    `   서명 유효: ${verifyResult.checks.signatureValid ? "✅" : "❌"}`
  );
  console.log(
    `   서명자 일치: ${verifyResult.checks.signerMatch ? "✅" : "❌"}`
  );
  console.log(
    `   문서 무결성: ${verifyResult.checks.documentIntact ? "✅" : "❌"}`
  );
  console.log(`\n   복원된 주소: ${verifyResult.recoveredAddress}`);

  if (verifyResult.valid) {
    logSuccess("✅ 서명이 유효합니다!");
  }

  // ========================================
  // Part 3: 위변조 탐지
  // ========================================
  logSection("Part 3: 위변조 탐지");

  logStep(4, "문서 내용 변조 시도");

  const tamperedDoc: SignedDocument = {
    document: {
      ...signedByTransferor.document,
      content: signedByTransferor.document.content.replace(
        "1,000주",
        "10,000주"
      ),
    },
    signature: signedByTransferor.signature,
  };

  console.log("\n⚠️ 공격자가 '1,000주'를 '10,000주'로 변조 시도");

  const tamperedResult = await verifySignature(tamperedDoc);

  console.log("\n🔍 변조된 문서 검증:");
  console.log(`   서명 유효: ${tamperedResult.valid ? "✅" : "❌"}`);
  console.log(`   복원된 주소: ${tamperedResult.recoveredAddress}`);
  console.log(`   원래 서명자: ${tamperedResult.declaredSigner}`);

  if (!tamperedResult.valid) {
    logSuccess("✅ 위변조 탐지 성공! 문서가 변경되면 서명 검증 실패");
  }

  // ========================================
  // Part 4: 다른 사람의 서명 위조 시도
  // ========================================
  logSection("Part 4: 서명 위조 시도");

  logStep(5, "공격자가 다른 사람 서명 위조 시도");

  const attackerPrivateKey =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const attacker = getSigner(attackerPrivateKey);

  const attackerSignedDoc = await signDocument(document, attacker);

  const forgedDoc: SignedDocument = {
    document: attackerSignedDoc.document,
    signature: {
      ...attackerSignedDoc.signature,
      signer: signedByTransferor.signature.signer,
      signerAddress: signedByTransferor.signature.signerAddress,
    },
  };

  console.log("\n⚠️ 공격자가:");
  console.log(`   자신의 키로 서명 후`);
  console.log(`   서명자 정보를 ${signedByTransferor.signature.signer}로 위조`);

  const forgedResult = await verifySignature(forgedDoc);

  console.log("\n🔍 위조 서명 검증:");
  console.log(`   서명 유효: ${forgedResult.valid ? "✅" : "❌"}`);
  console.log(`   복원된 주소: ${forgedResult.recoveredAddress}`);
  console.log(`   선언된 주소: ${forgedResult.declaredSigner}`);
  console.log(
    `   주소 일치: ${forgedResult.checks.signerMatch ? "✅" : "❌ 불일치!"}`
  );

  if (!forgedResult.valid) {
    logSuccess("✅ 위조 탐지 성공! 개인키 없이는 서명 위조 불가능");
    logInfo(
      `   실제 서명자: ${addressToDid(forgedResult.recoveredAddress)} (공격자)`
    );
  }

  // ========================================
  // Part 5: DID로 서명자 신원 확인
  // ========================================
  logSection("Part 5: DID로 서명자 신원 확인");

  logStep(6, "블록체인에서 서명자 DID 확인");

  try {
    const contract = getContract();
    const signerAddress = signedByTransferor.signature.signerAddress;
    const owner = await contract.identityOwner(signerAddress);

    console.log(`\n📋 서명자 DID 정보:`);
    console.log(`   DID: ${signedByTransferor.signature.signer}`);
    console.log(`   주소: ${signerAddress}`);
    console.log(`   Owner: ${owner}`);
    console.log(
      `   Self-owned: ${
        owner.toLowerCase() === signerAddress.toLowerCase() ? "✅" : "❌"
      }`
    );

    logSuccess("블록체인에서 서명자 신원 확인 완료!");
  } catch {
    logWarning("블록체인 연결 실패. DID 확인 생략.");
  }

  // ========================================
  // Summary
  // ========================================
  logSection("📚 학습 요약");
  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                      전자문서 서명                           │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  1. 서명 생성                                               │
  │     • 문서 → JSON → 해시 → 개인키로 서명                    │
  │     • 결과: 서명값 (0x...)                                  │
  │                                                             │
  │  2. 서명 검증                                               │
  │     • 서명에서 주소 복원 (ecrecover)                        │
  │     • 복원 주소 == 선언 주소 → 유효!                        │
  │                                                             │
  │  3. 보안 특성                                               │
  │     • 문서 변조 → 다른 주소 복원 → 탐지!                    │
  │     • 서명 위조 → 개인키 없이 불가능                        │
  │                                                             │
  │  4. DID 연동                                                │
  │     • 서명자 DID로 신원 확인                                │
  │     • 블록체인에서 Owner/Delegate 확인                      │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  🎉 전자문서 서명 예제 완료!
  
  다음 예제: 03-credential-issuance (VC 발급)
  `);
}

main().catch(console.error);
