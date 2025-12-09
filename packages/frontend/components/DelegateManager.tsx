"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Address, isAddress } from "viem";
import {
  useAddDelegate,
  useRevokeDelegate,
  useValidDelegate,
} from "@/lib/hooks";
import { DELEGATE_TYPES } from "@/lib/contracts";

export function DelegateManager() {
  const { address } = useAccount();
  const [delegateAddress, setDelegateAddress] = useState("");
  const [delegateType, setDelegateType] = useState<string>(
    DELEGATE_TYPES.SIG_AUTH
  );
  const [validity, setValidity] = useState("30");
  const [checkDelegate, setCheckDelegate] = useState("");
  const [checkType, setCheckType] = useState<string>(DELEGATE_TYPES.SIG_AUTH);

  const {
    addDelegate,
    isPending: isAdding,
    isConfirming: isAddConfirming,
    isSuccess: isAddSuccess,
    error: addError,
  } = useAddDelegate();

  const {
    revokeDelegate,
    isPending: isRevoking,
    isConfirming: isRevokeConfirming,
    isSuccess: isRevokeSuccess,
    error: revokeError,
  } = useRevokeDelegate();

  const { data: isValidDelegate, refetch } = useValidDelegate(
    address,
    checkType,
    isAddress(checkDelegate) ? (checkDelegate as Address) : undefined
  );

  const handleAddDelegate = () => {
    if (!address || !isAddress(delegateAddress)) return;
    const validitySeconds = BigInt(Number(validity) * 24 * 60 * 60); // Convert days to seconds
    addDelegate(
      address,
      delegateType,
      delegateAddress as Address,
      validitySeconds
    );
  };

  const handleRevokeDelegate = () => {
    if (!address || !isAddress(delegateAddress)) return;
    revokeDelegate(address, delegateType, delegateAddress as Address);
  };

  if (isAddSuccess || isRevokeSuccess) {
    refetch();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">
        Delegate Management
      </h2>

      <div className="space-y-6">
        {/* Add Delegate */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Add Delegate
          </h3>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="delegateType"
                className="block text-sm font-medium text-gray-700"
              >
                Delegate Type
              </label>
              <select
                id="delegateType"
                value={delegateType}
                onChange={(e) => setDelegateType(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={DELEGATE_TYPES.SIG_AUTH}>
                  Signature Auth (sigAuth)
                </option>
                <option value={DELEGATE_TYPES.VERI_KEY}>
                  Verification Key (veriKey)
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="delegateAddress"
                className="block text-sm font-medium text-gray-700"
              >
                Delegate Address
              </label>
              <input
                id="delegateAddress"
                type="text"
                placeholder="0x..."
                value={delegateAddress}
                onChange={(e) => setDelegateAddress(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="validity"
                className="block text-sm font-medium text-gray-700"
              >
                Validity (days)
              </label>
              <input
                id="validity"
                type="number"
                min="1"
                value={validity}
                onChange={(e) => setValidity(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddDelegate}
                disabled={
                  !address ||
                  !isAddress(delegateAddress) ||
                  isAdding ||
                  isAddConfirming
                }
                className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isAdding || isAddConfirming ? "Adding..." : "Add Delegate"}
              </button>
              <button
                onClick={handleRevokeDelegate}
                disabled={
                  !address ||
                  !isAddress(delegateAddress) ||
                  isRevoking ||
                  isRevokeConfirming
                }
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isRevoking || isRevokeConfirming
                  ? "Revoking..."
                  : "Revoke Delegate"}
              </button>
            </div>

            {addError && (
              <p className="text-sm text-red-600">
                Add Error: {addError.message}
              </p>
            )}
            {revokeError && (
              <p className="text-sm text-red-600">
                Revoke Error: {revokeError.message}
              </p>
            )}
            {isAddSuccess && (
              <p className="text-sm text-green-600">
                ✓ Delegate added successfully!
              </p>
            )}
            {isRevokeSuccess && (
              <p className="text-sm text-green-600">
                ✓ Delegate revoked successfully!
              </p>
            )}
          </div>
        </div>

        {/* Check Delegate */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Check Delegate Status
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={checkType}
                onChange={(e) => setCheckType(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={DELEGATE_TYPES.SIG_AUTH}>sigAuth</option>
                <option value={DELEGATE_TYPES.VERI_KEY}>veriKey</option>
              </select>
              <input
                type="text"
                placeholder="Delegate address to check"
                value={checkDelegate}
                onChange={(e) => setCheckDelegate(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => refetch()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Check
              </button>
            </div>
            {isAddress(checkDelegate) && (
              <p className="text-sm">
                Status:{" "}
                <span
                  className={
                    isValidDelegate
                      ? "text-green-600 font-medium"
                      : "text-red-600 font-medium"
                  }
                >
                  {isValidDelegate ? "✓ Valid" : "✗ Invalid or Expired"}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
