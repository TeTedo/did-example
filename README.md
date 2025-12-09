# Ethereum DID

ERC-1056 기반의 이더리움 탈중앙화 신원(DID) 관리 시스템입니다.

## 프로젝트 구조

```
ethereum-did/
├── packages/
│   ├── solidity/      # 스마트 컨트랙트 (Foundry + Soldeer)
│   ├── backend/       # API 서버 (NestJS + TypeORM + MySQL)
│   └── frontend/      # 웹 클라이언트 (Next.js + Wagmi + TailwindCSS)
├── data/              # Docker 데이터 볼륨
├── docker-compose.yml # Docker 서비스 설정
└── pnpm-workspace.yaml
```

## 사전 요구사항

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Foundry (Solidity 개발용)
- Docker & Docker Compose (MySQL 실행용)

## 설치

```bash
# pnpm 설치 (없는 경우)
npm install -g pnpm

# 의존성 설치
pnpm install

# Foundry 설치 (없는 경우)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## 개발 환경 실행

### 1. 데이터베이스 실행

```bash
# MySQL 컨테이너 실행
docker-compose up -d mysql
```

### 2. 로컬 블록체인 실행

```bash
# Anvil 로컬 노드 실행
cd packages/solidity
anvil
```

### 3. 스마트 컨트랙트 배포

새 터미널에서:

```bash
cd packages/solidity

# 환경변수 설정
cp env.example.txt .env

# 컨트랙트 배포 (Anvil 기본 계정 사용)
forge script script/DeployDIDRegistry.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### 4. 백엔드 서버 실행

```bash
cd packages/backend

# 환경변수 설정
cp env.example.txt .env

# 개발 서버 실행
pnpm start:dev
```

### 5. 프론트엔드 실행

```bash
cd packages/frontend

# 개발 서버 실행
pnpm dev
```

## 환경 변수

### Backend (`packages/backend/.env`)

```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=password
DB_DATABASE=ethereum_did
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
CORS_ORIGIN=http://localhost:3000
```

### Frontend (`packages/frontend/.env.local`)

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 주요 기능

### 스마트 컨트랙트 (ERC-1056)

- **Identity Ownership**: DID 소유권 관리 및 이전
- **Delegates**: 서명 권한 위임 (sigAuth, veriKey)
- **Attributes**: 공개키, 서비스 엔드포인트 등 속성 관리
- **Meta-transactions**: 가스리스 트랜잭션 지원

### 백엔드 API

- `GET /api/did/:address` - DID Document 조회
- `GET /api/did/:address/owner` - 소유자 조회
- `GET /api/did/:address/delegates` - 대리인 목록 조회
- `GET /api/did/:address/attributes` - 속성 목록 조회
- `GET /api/events` - 이벤트 목록 조회
- `GET /api/events/stats/summary` - 이벤트 통계
- `GET /health` - 서버 상태 확인
- **WebSocket** - 실시간 이벤트 스트리밍

### 프론트엔드

- MetaMask 지갑 연결
- DID 소유권 조회 및 이전
- 대리인(Delegate) 추가/해제/유효성 검사
- 속성(Attribute) 설정/해제
- 실시간 이벤트 대시보드

## 테스트

```bash
# Solidity 테스트
cd packages/solidity
forge test

# Backend 테스트
cd packages/backend
pnpm test
```

## 기술 스택

| 레이어         | 기술                                            |
| -------------- | ----------------------------------------------- |
| Smart Contract | Solidity 0.8.28, Foundry, Soldeer               |
| Backend        | NestJS 11, TypeORM, MySQL, Socket.io, ethers.js |
| Frontend       | Next.js 16, React 19, Wagmi, Viem, TailwindCSS  |
| DevOps         | Docker, pnpm workspaces                         |

## 라이선스

MIT
