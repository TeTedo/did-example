"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { CONTRACT_ADDRESS, ETHEREUM_DID_REGISTRY_ABI } from "./contracts";
import { Address, stringToHex } from "viem";

// Read hooks
export function useIdentityOwner(identity?: Address) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ETHEREUM_DID_REGISTRY_ABI,
    functionName: "identityOwner",
    args: identity ? [identity] : undefined,
    query: {
      enabled: !!identity,
    },
  });
}

export function useValidDelegate(
  identity?: Address,
  delegateType?: string,
  delegate?: Address
) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ETHEREUM_DID_REGISTRY_ABI,
    functionName: "validDelegate",
    args:
      identity && delegateType && delegate
        ? [identity, stringToHex(delegateType, { size: 32 }), delegate]
        : undefined,
    query: {
      enabled: !!identity && !!delegateType && !!delegate,
    },
  });
}

export function useNonce(owner?: Address) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ETHEREUM_DID_REGISTRY_ABI,
    functionName: "nonce",
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

export function useChanged(identity?: Address) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ETHEREUM_DID_REGISTRY_ABI,
    functionName: "changed",
    args: identity ? [identity] : undefined,
    query: {
      enabled: !!identity,
    },
  });
}

// Write hooks
export function useChangeOwner() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const changeOwner = (identity: Address, newOwner: Address) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ETHEREUM_DID_REGISTRY_ABI,
      functionName: "changeOwner",
      args: [identity, newOwner],
    });
  };

  return {
    changeOwner,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useAddDelegate() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const addDelegate = (
    identity: Address,
    delegateType: string,
    delegate: Address,
    validity: bigint
  ) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ETHEREUM_DID_REGISTRY_ABI,
      functionName: "addDelegate",
      args: [
        identity,
        stringToHex(delegateType, { size: 32 }),
        delegate,
        validity,
      ],
    });
  };

  return {
    addDelegate,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useRevokeDelegate() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const revokeDelegate = (
    identity: Address,
    delegateType: string,
    delegate: Address
  ) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ETHEREUM_DID_REGISTRY_ABI,
      functionName: "revokeDelegate",
      args: [identity, stringToHex(delegateType, { size: 32 }), delegate],
    });
  };

  return {
    revokeDelegate,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useSetAttribute() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const setAttribute = (
    identity: Address,
    name: string,
    value: string,
    validity: bigint
  ) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ETHEREUM_DID_REGISTRY_ABI,
      functionName: "setAttribute",
      args: [
        identity,
        stringToHex(name, { size: 32 }),
        stringToHex(value),
        validity,
      ],
    });
  };

  return {
    setAttribute,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useRevokeAttribute() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const revokeAttribute = (identity: Address, name: string, value: string) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ETHEREUM_DID_REGISTRY_ABI,
      functionName: "revokeAttribute",
      args: [identity, stringToHex(name, { size: 32 }), stringToHex(value)],
    });
  };

  return {
    revokeAttribute,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
