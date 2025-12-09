# 📚 DID/VC 예제 모음

이더리움 DID와 Verifiable Credentials의 다양한 사용 사례를 담은 예제 모음입니다.

## 🎯 예제 목록

| #   | 예제                | 설명                       | 난이도 |
| --- | ------------------- | -------------------------- | ------ |
| 01  | Basic DID           | DID 생성, 조회, Owner 변경 | ⭐     |
| 02  | Document Signing    | 전자문서 서명 및 검증      | ⭐⭐   |
| 03  | Credential Issuance | VC 발급/검증 (졸업증명서)  | ⭐⭐   |
| 04  | Login Auth          | DID 기반 로그인            | ⭐⭐   |
| 05  | Delegation          | 대리인 위임 및 서명        | ⭐⭐⭐ |
| 06  | Revocation          | VC 폐기 및 상태 확인       | ⭐⭐⭐ |

## 🚀 시작하기

### 1. 의존성 설치

```bash
cd packages/examples
pnpm install
```

### 2. 로컬 블록체인 실행 (Anvil)

```bash
cd packages/solidity
anvil
```

### 3. DID Registry 컨트랙트 배포

```bash
cd packages/solidity
forge script script/DeployDIDRegistry.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### 4. 예제 실행

```bash
cd packages/examples

pnpm run 01   # Basic DID
pnpm run 02   # Document Signing
pnpm run 03   # Credential Issuance
pnpm run 04   # Login Authentication
pnpm run 05   # Delegation
pnpm run 06   # Revocation
```

## 📁 프로젝트 구조

```
packages/examples/
├── common/                 # 공통 유틸리티
│   └── config.ts           # 설정, 헬퍼 함수
├── 01-basic-did/
│   ├── index.ts            # 메인 실행 파일
│   └── README.md
├── 02-document-signing/
│   ├── index.ts
│   └── README.md
├── 03-credential-issuance/
│   ├── index.ts
│   └── README.md
├── 04-login-authentication/
│   ├── index.ts
│   └── README.md
├── 05-delegation/
│   ├── index.ts
│   └── README.md
├── 06-revocation/
│   ├── index.ts
│   └── README.md
└── package.json
```

## 📖 학습 순서

```
01 Basic DID (기초)
    │
    ▼
02 Document Signing (전자서명)
    │
    ▼
03 Credential Issuance (VC 발급)
    │
    ▼
04 Login Authentication (로그인)
    │
    ▼
05 Delegation (위임)
    │
    ▼
06 Revocation (폐기)
```

## ⚙️ 환경 설정

### 환경 변수 (선택)

`.env` 파일을 생성하여 설정을 변경할 수 있습니다:

```bash
# RPC URL (로컬 Anvil 또는 테스트넷)
RPC_URL=http://127.0.0.1:8545

# DID Registry 컨트랙트 주소
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3

# 테스트용 개인키 (Anvil 기본 계정)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

> ⚠️ **주의**: 실제 자산이 있는 계정의 개인키는 절대 사용하지 마세요!

## 🔗 관련 자료

- [ERC-1056 (Ethereum DID)](https://eips.ethereum.org/EIPS/eip-1056)
- [W3C DID Core 1.0](https://www.w3.org/TR/did-core/)
- [W3C VC Data Model 1.1](https://www.w3.org/TR/vc-data-model/)
- [did:ethr Method Specification](https://github.com/decentralized-identity/ethr-did-resolver)
