import EthereumDIDRegistryABI from "./contracts/EthereumDIDRegistry.json";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x5FbDB2315678afecb367f032d93F642f64180aa3") as `0x${string}`;

export const ETHEREUM_DID_REGISTRY_ABI = EthereumDIDRegistryABI;

export const DELEGATE_TYPES = {
  SIG_AUTH: "sigAuth",
  VERI_KEY: "veriKey",
} as const;

export const ATTRIBUTE_NAMES = {
  PUBLIC_KEY_ED25519: "did/pub/Ed25519/veriKey/base64",
  PUBLIC_KEY_SECP256K1: "did/pub/Secp256k1/veriKey/hex",
  SERVICE_ENDPOINT: "did/svc/MessagingService",
} as const;
