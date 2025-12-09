import { ethers } from "ethers";
import * as dotenv from "dotenv";

// .env 파일 로드
dotenv.config();

// 환경변수 설정
export const config = {
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  contractAddress:
    process.env.CONTRACT_ADDRESS ||
    "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  privateKey:
    process.env.PRIVATE_KEY ||
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
};

// DID Registry ABI (필요한 함수만)
export const DID_REGISTRY_ABI = [
  // Events
  "event DIDOwnerChanged(address indexed identity, address owner, uint256 previousChange)",
  "event DIDDelegateChanged(address indexed identity, bytes32 delegateType, address delegate, uint256 validTo, uint256 previousChange)",
  "event DIDAttributeChanged(address indexed identity, bytes32 name, bytes value, uint256 validTo, uint256 previousChange)",

  // Read functions
  "function identityOwner(address identity) view returns (address)",
  "function validDelegate(address identity, bytes32 delegateType, address delegate) view returns (bool)",
  "function changed(address identity) view returns (uint256)",
  "function nonce(address identity) view returns (uint256)",

  // Write functions
  "function changeOwner(address identity, address newOwner)",
  "function changeOwnerSigned(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, address newOwner)",
  "function addDelegate(address identity, bytes32 delegateType, address delegate, uint256 validity)",
  "function revokeDelegate(address identity, bytes32 delegateType, address delegate)",
  "function setAttribute(address identity, bytes32 name, bytes value, uint256 validity)",
  "function revokeAttribute(address identity, bytes32 name, bytes value)",
];

// Provider 생성
export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(config.rpcUrl);
}

// Signer 생성 (개인키로)
export function getSigner(
  privateKey: string = config.privateKey
): ethers.Wallet {
  const provider = getProvider();
  return new ethers.Wallet(privateKey, provider);
}

// DID Registry 컨트랙트 인스턴스 생성
export function getContract(signer?: ethers.Signer): ethers.Contract {
  const signerOrProvider = signer || getProvider();
  return new ethers.Contract(
    config.contractAddress,
    DID_REGISTRY_ABI,
    signerOrProvider
  );
}

// 주소를 DID로 변환
export function addressToDid(address: string): string {
  return `did:ethr:${address.toLowerCase()}`;
}

// DID에서 주소 추출
export function didToAddress(did: string): string {
  const parts = did.split(":");
  return parts[parts.length - 1].toLowerCase();
}

// 콘솔 출력 헬퍼
export function logSection(title: string): void {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

export function logStep(step: number, description: string): void {
  console.log(`\n📍 Step ${step}: ${description}`);
  console.log("-".repeat(40));
}

export function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

export function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}

export function logWarning(message: string): void {
  console.log(`⚠️  ${message}`);
}

export function logError(message: string): void {
  console.log(`❌ ${message}`);
}
