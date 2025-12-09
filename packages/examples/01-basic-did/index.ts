/**
 * 01-basic-did/run-all.ts
 *
 * 모든 기본 DID 예제를 순서대로 실행
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
  getContract,
  getSigner,
  getProvider,
} from "../common/config.js";

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              🎓 DID 기본 개념 종합 예제                         ║
║                                                               ║
║   이 예제에서 배우는 것:                                        ║
║   1. DID 생성 (지갑 = DID)                                     ║
║   2. DID Document 조회                                        ║
║   3. Owner 변경                                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // 연결 테스트
  const provider = getProvider();
  try {
    await provider.getBlockNumber();
  } catch {
    logError("블록체인 연결 실패!");
    logInfo("");
    logInfo("📌 사전 준비:");
    logInfo("   1. Anvil 실행: cd packages/solidity && anvil");
    logInfo(
      "   2. 컨트랙트 배포: forge script script/DeployDIDRegistry.s.sol --rpc-url http://127.0.0.1:8545 --broadcast"
    );
    return;
  }

  // ========================================
  // Part 1: DID 생성
  // ========================================
  logSection("Part 1: DID 생성");

  logStep(1, "새 지갑 생성 = DID 생성");
  const newWallet = ethers.Wallet.createRandom();
  const newDid = addressToDid(newWallet.address);

  logInfo(`생성된 지갑 주소: ${newWallet.address}`);
  logSuccess(`생성된 DID: ${newDid}`);

  logInfo("");
  logInfo("💡 핵심: 지갑 생성 = DID 생성");
  logInfo("   별도의 등록 과정이 필요 없습니다!");

  // ========================================
  // Part 2: DID Document 조회
  // ========================================
  logSection("Part 2: DID Document 조회");

  // Anvil 기본 계정 사용
  const privateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const signer = getSigner(privateKey);
  const did = addressToDid(signer.address);

  logStep(2, `DID Document 조회: ${did}`);

  const contract = getContract(signer);
  const owner = await contract.identityOwner(signer.address);

  const didDocument = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/secp256k1recovery-2020/v2",
    ],
    id: did,
    verificationMethod: [
      {
        id: `${did}#controller`,
        type: "EcdsaSecp256k1RecoveryMethod2020",
        controller: addressToDid(owner),
        blockchainAccountId: `eip155:1:${signer.address}`,
      },
    ],
    authentication: [`${did}#controller`],
    assertionMethod: [`${did}#controller`],
  };

  console.log("\n📄 DID Document:");
  console.log(JSON.stringify(didDocument, null, 2));

  logSuccess("DID Document 조회 성공!");

  // ========================================
  // Part 3: Owner 변경
  // ========================================
  logSection("Part 3: Owner 변경");

  // Account #1 (새 Owner)
  const privateKey1 =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const signer1 = getSigner(privateKey1);

  logStep(3, "Owner 변경 전 상태 확인");
  const ownerBefore = await contract.identityOwner(signer.address);
  logInfo(`현재 Owner: ${ownerBefore}`);

  logStep(4, "Owner 변경 트랜잭션");
  logInfo(`changeOwner(${signer.address}, ${signer1.address})`);

  const tx = await contract.changeOwner(signer.address, signer1.address);
  await tx.wait();

  const ownerAfter = await contract.identityOwner(signer.address);
  logInfo(`새 Owner: ${ownerAfter}`);
  logSuccess("Owner 변경 완료!");

  logStep(5, "권한 확인 - 기존 Owner는 더 이상 제어 불가");
  try {
    const tx2 = await contract.changeOwner(signer.address, signer.address);
    await tx2.wait();
    logWarning("예상과 다르게 성공 (확인 필요)");
  } catch {
    logSuccess("예상대로 실패! 기존 Owner는 권한 없음");
  }

  logStep(6, "원상 복구 - 새 Owner가 권한 반환");
  const contract1 = getContract(signer1);
  const tx3 = await contract1.changeOwner(signer.address, signer.address);
  await tx3.wait();

  const ownerRestored = await contract.identityOwner(signer.address);
  logSuccess(`Owner 복구됨: ${ownerRestored}`);

  // ========================================
  // Summary
  // ========================================
  logSection("📚 학습 요약");
  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                      DID 기본 개념                           │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  1. DID 생성                                                │
  │     • 지갑 생성 = DID 생성                                   │
  │     • did:ethr:{지갑주소}                                    │
  │     • 블록체인 등록 불필요                                    │
  │                                                             │
  │  2. DID Document                                            │
  │     • DID에 대한 메타데이터                                   │
  │     • 공개키, 인증 방법 포함                                  │
  │     • 개인정보 없음!                                         │
  │                                                             │
  │  3. Owner 변경                                              │
  │     • 현재 Owner만 변경 가능                                 │
  │     • 키 교체, 계정 이전에 사용                               │
  │     • DIDOwnerChanged 이벤트 발생                           │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  🎉 기본 DID 예제 완료!
  
  다음 예제: 02-document-signing (전자문서 서명)
  `);
}

main().catch(console.error);
