"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Address, isAddress } from "viem";
import { useIdentityOwner, useChangeOwner } from "@/lib/hooks";

export function IdentityManager() {
  const { address } = useAccount();
  const [newOwner, setNewOwner] = useState("");

  const { data: owner, refetch } = useIdentityOwner(address);
  const { changeOwner, isPending, isConfirming, isSuccess, error } =
    useChangeOwner();

  const handleChangeOwner = () => {
    if (!address || !isAddress(newOwner)) return;
    changeOwner(address, newOwner as Address);
  };

  if (isSuccess) {
    refetch();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">
        Identity Ownership
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Your Identity
          </label>
          <p className="mt-1 font-mono text-sm text-gray-900">
            {address || "Not connected"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Current Owner
          </label>
          <p className="mt-1 font-mono text-sm text-gray-900">
            {owner
              ? owner === address
                ? "You (self-owned)"
                : String(owner)
              : "Loading..."}
          </p>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <label
            htmlFor="newOwner"
            className="block text-sm font-medium text-gray-700"
          >
            Transfer Ownership
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="newOwner"
              type="text"
              placeholder="0x..."
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleChangeOwner}
              disabled={
                !address || !isAddress(newOwner) || isPending || isConfirming
              }
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? "Processing..." : "Transfer"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">Error: {error.message}</p>
          )}
          {isSuccess && (
            <p className="mt-2 text-sm text-green-600">
              ✓ Ownership transferred successfully!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
