# 06 - Revocation (VC 폐기)

Issuer가 발급한 Verifiable Credential을 폐기(무효화)하는 방법을 배웁니다.

## 📚 학습 목표

1. **VC 폐기**: Issuer가 발급한 VC 무효화
2. **폐기 확인**: Verifier가 VC의 폐기 상태 확인
3. **On-chain 기록**: 블록체인에 영구 폐기 기록 저장

## 🚀 실행 방법

```bash
# 예제 실행
pnpm run 06
```

## 💡 핵심 개념

### 1. 왜 폐기가 필요한가?

- 자격 취소 (면허 박탈, 자격증 취소)
- 오발급 정정
- 유효기간 전 조기 만료
- 정보 변경 후 재발급

### 2. 폐기 방법

| 방법      | 장점            | 단점        |
| --------- | --------------- | ----------- |
| Off-chain | 빠름, 비용 없음 | 중앙화 위험 |
| On-chain  | 영구, 신뢰      | 가스비 필요 |

### 3. 검증 흐름

```
VC 제출
   │
   ├─ 1. 서명 검증
   │      └── Issuer가 서명했는지 확인
   │
   ├─ 2. 만료 확인
   │      └── expirationDate 확인
   │
   └─ 3. 폐기 확인 ⭐
          ├── Off-chain: API 호출
          └── On-chain: 블록체인 조회

   모두 통과 → ✅ 유효
   하나라도 실패 → ❌ 무효
```

### 4. 폐기 후 VC 특성

```
┌─────────────────────────────────────────┐
│  폐기된 VC                               │
├─────────────────────────────────────────┤
│  ✅ 서명은 여전히 유효                   │
│     (VC 자체는 변조되지 않음)            │
│                                         │
│  ❌ 하지만 폐기 상태                     │
│     (Revocation Registry에 등록됨)      │
│                                         │
│  💡 서명 유효 ≠ VC 유효                  │
│     폐기 확인은 필수!                    │
└─────────────────────────────────────────┘
```

## 🔧 On-Chain 폐기 (DID Registry 활용)

```typescript
// setAttribute로 폐기 기록 저장
contract.setAttribute(
  issuerAddress,
  "did/revoked", // Attribute name
  revokedCredentialInfo, // VC ID, 사유, 시간
  1 // 1초 (기록용)
);
```

## 💼 사용 사례

- **의료**: 의사 면허 취소
- **교육**: 학위 취소
- **자격증**: 자격 정지/취소
- **신분증**: 분실 신고

## 🔗 관련 자료

- [W3C VC Status](https://www.w3.org/TR/vc-data-model/#status)
- [Revocation List 2020](https://w3c-ccg.github.io/vc-status-rl-2020/)

## ✅ 예제 완료!

모든 예제를 완료했습니다. 🎉
