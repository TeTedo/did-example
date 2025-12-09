/**
 * 04-login-authentication/index.ts
 *
 * DID 기반 로그인 전체 시나리오
 */

import { ethers } from "ethers";
import {
  logSection,
  logStep,
  logSuccess,
  logInfo,
  addressToDid,
  didToAddress,
  getSigner,
} from "../common/config.js";

// ========================================
// Types
// ========================================

interface LoginChallenge {
  id: string;
  challenge: string;
  domain: string;
  issuedAt: string;
  expiresAt: string;
}

interface LoginRequest {
  challengeId: string;
  did: string;
  signature: string;
}

interface LoginResponse {
  success: boolean;
  sessionToken?: string;
  user?: {
    did: string;
    address: string;
    loginAt: string;
  };
  error?: string;
}

interface Session {
  did: string;
  address: string;
  expiresAt: string;
}

// ========================================
// Server State (In-Memory)
// ========================================

const serverState = {
  challenges: new Map<string, LoginChallenge>(),
  sessions: new Map<string, Session>(),
};

// ========================================
// Server Functions
// ========================================

function generateChallenge(domain: string): LoginChallenge {
  const challenge: LoginChallenge = {
    id: crypto.randomUUID(),
    challenge: `0x${Buffer.from(
      crypto.getRandomValues(new Uint8Array(32))
    ).toString("hex")}`,
    domain,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5분
  };

  serverState.challenges.set(challenge.id, challenge);
  return challenge;
}

function createSignMessage(challenge: LoginChallenge): string {
  return `Sign this message to login to ${challenge.domain}\n\nChallenge: ${challenge.challenge}\nIssued At: ${challenge.issuedAt}`;
}

async function verifyLogin(request: LoginRequest): Promise<LoginResponse> {
  const challenge = serverState.challenges.get(request.challengeId);

  if (!challenge) {
    return { success: false, error: "Invalid or expired challenge" };
  }

  // 챌린지 삭제 (일회용)
  serverState.challenges.delete(request.challengeId);

  // 만료 확인
  if (new Date(challenge.expiresAt) < new Date()) {
    return { success: false, error: "Challenge expired" };
  }

  // 서명 검증
  const message = createSignMessage(challenge);

  try {
    const recoveredAddress = ethers.verifyMessage(message, request.signature);
    const expectedAddress = didToAddress(request.did);

    if (recoveredAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
      return {
        success: false,
        error: "Signature does not match DID",
      };
    }

    // 세션 생성
    const sessionToken = crypto.randomUUID();
    const session: Session = {
      did: request.did,
      address: recoveredAddress,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24시간
    };

    serverState.sessions.set(sessionToken, session);

    return {
      success: true,
      sessionToken,
      user: {
        did: request.did,
        address: recoveredAddress,
        loginAt: new Date().toISOString(),
      },
    };
  } catch {
    return { success: false, error: "Invalid signature" };
  }
}

function verifySession(token: string): Session | null {
  const session = serverState.sessions.get(token);

  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    serverState.sessions.delete(token);
    return null;
  }

  return session;
}

function logout(token: string): boolean {
  return serverState.sessions.delete(token);
}

function resetServerState(): void {
  serverState.challenges.clear();
  serverState.sessions.clear();
}

// ========================================
// Client Functions
// ========================================

async function signChallenge(
  challenge: LoginChallenge,
  wallet: ethers.Wallet
): Promise<string> {
  const message = createSignMessage(challenge);
  return await wallet.signMessage(message);
}

function createLoginRequest(
  challengeId: string,
  did: string,
  signature: string
): LoginRequest {
  return { challengeId, did, signature };
}

// ========================================
// Main
// ========================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              🔐 DID 기반 로그인 종합 예제                       ║
║                                                               ║
║   기존 로그인: 아이디 + 비밀번호                                ║
║   DID 로그인: 지갑 서명으로 인증 (비밀번호 없음!)                ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  resetServerState();

  // ========================================
  // Part 1: 정상 로그인 흐름
  // ========================================
  logSection("Part 1: 정상 로그인 흐름");

  const userPrivateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const user = getSigner(userPrivateKey);
  const userDid = addressToDid(user.address);

  logStep(1, "사용자가 로그인 페이지 접속");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │      🌐 MyApp.com 로그인                                    │
  │                                                             │
  │      ┌───────────────────────────────────────┐              │
  │      │                                       │              │
  │      │     🦊 MetaMask로 로그인              │              │
  │      │                                       │              │
  │      └───────────────────────────────────────┘              │
  │                                                             │
  │      비밀번호 없이 지갑 서명만으로 로그인!                    │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
  `);

  logStep(2, "서버: 챌린지 생성");

  const challenge = generateChallenge("myapp.com");

  logInfo(`챌린지 ID: ${challenge.id}`);
  logInfo(`만료: ${challenge.expiresAt}`);

  logStep(3, "클라이언트: MetaMask 서명 요청");

  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  🦊 MetaMask 서명 요청                                      │
  │                                                             │
  │  "myapp.com에서 로그인 서명을 요청합니다"                     │
  │                                                             │
  │  메시지:                                                     │
  │  ─────────────────────────────────────────────              │
  │  Sign this message to login to myapp.com                    │
  │                                                             │
  │  Challenge: ${challenge.challenge.substring(0, 30)}...      │
  │  ─────────────────────────────────────────────              │
  │                                                             │
  │          [거부]              [서명]                          │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
  `);

  const signature = await signChallenge(challenge, user);

  logSuccess("사용자가 서명 승인!");

  logStep(4, "서버: 서명 검증 & 세션 발급");

  const loginRequest = createLoginRequest(challenge.id, userDid, signature);
  const response = await verifyLogin(loginRequest);

  if (response.success) {
    logSuccess("🎉 로그인 성공!");

    console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │      ✅ 로그인 완료!                                        │
  │                                                             │
  │      환영합니다, ${userDid.substring(0, 30)}...             │
  │                                                             │
  │      세션 만료: 24시간 후                                    │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
    `);
  }

  // ========================================
  // Part 2: 보호된 리소스 접근
  // ========================================
  logSection("Part 2: 보호된 리소스 접근");

  logStep(5, "인증된 API 요청");

  const sessionToken = response.sessionToken!;
  const session = verifySession(sessionToken);

  if (session) {
    console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  요청:                                                       │
  │  GET /api/my-profile                                        │
  │  Authorization: Bearer ${sessionToken.substring(0, 20)}...  │
  │                                                             │
  │  응답:                                                       │
  │  {                                                          │
  │    "did": "${session.did}",                                 │
  │    "address": "${session.address}",                         │
  │    "membership": "Premium",                                 │
  │    "createdAt": "2024-01-15"                                │
  │  }                                                          │
  └─────────────────────────────────────────────────────────────┘
    `);
    logSuccess("인증 성공! 데이터 반환");
  }

  // ========================================
  // Part 3: 공격 시나리오 - 챌린지 재사용
  // ========================================
  logSection("Part 3: 보안 테스트 - 챌린지 재사용 공격");

  logStep(6, "공격자가 같은 챌린지로 재요청");

  const replayRequest = createLoginRequest(challenge.id, userDid, signature);
  const replayResponse = await verifyLogin(replayRequest);

  if (!replayResponse.success) {
    logSuccess("✅ 방어 성공! 챌린지는 일회용입니다");
    logInfo(`   오류: ${replayResponse.error}`);
  }

  // ========================================
  // Part 4: 공격 시나리오 - 서명 위조
  // ========================================
  logSection("Part 4: 보안 테스트 - 서명 위조 공격");

  logStep(7, "공격자가 다른 사람의 DID로 로그인 시도");

  const newChallenge = generateChallenge("myapp.com");

  const attackerPrivateKey =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const attacker = getSigner(attackerPrivateKey);

  const attackerSignature = await signChallenge(newChallenge, attacker);

  const forgedRequest = createLoginRequest(
    newChallenge.id,
    userDid,
    attackerSignature
  );

  const forgedResponse = await verifyLogin(forgedRequest);

  if (!forgedResponse.success) {
    logSuccess("✅ 방어 성공! 서명이 DID와 일치하지 않습니다");
    logInfo(`   오류: ${forgedResponse.error}`);
  }

  // ========================================
  // Part 5: 로그아웃
  // ========================================
  logSection("Part 5: 로그아웃");

  logStep(8, "사용자 로그아웃");

  const loggedOut = logout(sessionToken);

  if (loggedOut) {
    logSuccess("로그아웃 완료!");
  }

  const expiredSession = verifySession(sessionToken);

  if (!expiredSession) {
    logInfo("세션 만료됨. 로그인 필요.");
  }

  // ========================================
  // Summary
  // ========================================
  logSection("📚 학습 요약");
  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │                    DID 기반 로그인                           │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  기존 로그인                    DID 로그인                   │
  │  ────────────                  ───────────                  │
  │  아이디 입력         →         지갑 연결                     │
  │  비밀번호 입력       →         서명 요청                     │
  │  서버에서 검증       →         서명 검증                     │
  │  세션 발급           →         세션 발급                     │
  │                                                             │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  장점:                                                       │
  │  ✅ 비밀번호 없음 (분실/유출 위험 없음)                       │
  │  ✅ 서버에 credential 저장 안 함                             │
  │  ✅ 피싱 저항성 (서명 메시지에 도메인 포함)                   │
  │  ✅ 여러 서비스에 같은 지갑으로 로그인                       │
  │                                                             │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  보안 기능:                                                  │
  │  🔒 챌린지 일회용 (재사용 공격 방지)                         │
  │  🔒 챌린지 만료 시간 (5분)                                   │
  │  🔒 서명 검증 (위조 불가)                                    │
  │  🔒 DID 검증 (블록체인 확인)                                 │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  🎉 DID 기반 로그인 예제 완료!
  
  다음 예제: 05-delegation (대리인 위임)
  `);
}

main().catch(console.error);
