# 01 - Basic DID (기본 DID 사용법)

이더리움 DID의 기본 개념과 사용법을 배웁니다.

## 📚 학습 목표

1. **DID 생성**: 지갑 생성 = DID 생성
2. **DID Document 조회**: DID의 메타데이터 이해
3. **Owner 변경**: DID 소유권 이전

## 🚀 실행 방법

```bash
# 예제 실행
pnpm run 01
```

## 💡 핵심 개념

### 1. DID = 지갑 주소

```
지갑 주소: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
     ↓
DID: did:ethr:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

- 별도의 등록 과정 불필요 (Implicit DID)
- 지갑 생성 = DID 생성
- 개인키 = DID 소유권

### 2. DID Document 구조

```json
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:ethr:0x...",
  "verificationMethod": [
    {
      "id": "did:ethr:0x...#controller",
      "type": "EcdsaSecp256k1RecoveryMethod2020",
      "controller": "did:ethr:0x...",
      "blockchainAccountId": "eip155:1:0x..."
    }
  ],
  "authentication": ["did:ethr:0x...#controller"],
  "assertionMethod": ["did:ethr:0x...#controller"]
}
```

### 3. Owner 변경

```
현재 Owner                새 Owner
     │                       │
     │  changeOwner()        │
     │ ─────────────────────→│
     │                       │
     │                  DIDOwnerChanged 이벤트
     │                       │
     ▼                       ▼
더 이상 제어 불가        이제 제어 가능
```

## 🔗 관련 자료

- [ERC-1056 (Ethereum DID)](https://eips.ethereum.org/EIPS/eip-1056)
- [W3C DID Core](https://www.w3.org/TR/did-core/)

## ➡️ 다음 예제

[02-document-signing](../02-document-signing/) - 전자문서 서명
