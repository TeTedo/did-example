# 02 - Document Signing (전자문서 서명)

DID를 사용한 전자문서 서명 및 검증을 배웁니다.

## 📚 학습 목표

1. **문서 서명**: 개인키로 문서에 서명
2. **서명 검증**: 서명에서 서명자 복원 및 검증
3. **위변조 탐지**: 문서 변조 시 탐지

## 🚀 실행 방법

```bash
# 예제 실행
pnpm run 02
```

## 💡 핵심 개념

### 1. 서명 과정

```
문서 (JSON)
     │
     ▼ JSON.stringify (정규화)
문자열
     │
     ▼ 개인키로 서명
서명값 (0x...)
```

### 2. 검증 과정

```
서명값 + 원본 문서
     │
     ▼ ecrecover
복원된 주소
     │
     ▼ 선언된 주소와 비교
일치 → ✅ 유효 / 불일치 → ❌ 위조
```

### 3. 보안 특성

| 공격 유형   | 방어 방법                       |
| ----------- | ------------------------------- |
| 문서 변조   | 서명 검증 실패 (다른 주소 복원) |
| 서명 위조   | 개인키 없이 불가능              |
| 서명자 위조 | 복원 주소와 불일치              |

## 📄 출력 파일

- `signed-contract.json`: 서명된 문서 예시

## 🔗 관련 자료

- [ECDSA 서명](https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm)
- [EIP-191 (Signed Data)](https://eips.ethereum.org/EIPS/eip-191)

## ➡️ 다음 예제

[03-credential-issuance](../03-credential-issuance/) - VC 발급
