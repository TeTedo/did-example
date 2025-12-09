"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useSetAttribute, useRevokeAttribute } from "@/lib/hooks";
import { ATTRIBUTE_NAMES } from "@/lib/contracts";

export function AttributeManager() {
  const { address } = useAccount();
  const [attributeName, setAttributeName] = useState<string>(
    ATTRIBUTE_NAMES.PUBLIC_KEY_ED25519
  );
  const [attributeValue, setAttributeValue] = useState("");
  const [validity, setValidity] = useState("365");

  const {
    setAttribute,
    isPending: isSetting,
    isConfirming: isSetConfirming,
    isSuccess: isSetSuccess,
    error: setError,
  } = useSetAttribute();
  const {
    revokeAttribute,
    isPending: isRevoking,
    isConfirming: isRevokeConfirming,
    isSuccess: isRevokeSuccess,
    error: revokeError,
  } = useRevokeAttribute();

  const handleSetAttribute = () => {
    if (!address || !attributeValue) return;
    const validitySeconds = BigInt(Number(validity) * 24 * 60 * 60); // Convert days to seconds
    setAttribute(address, attributeName, attributeValue, validitySeconds);
  };

  const handleRevokeAttribute = () => {
    if (!address || !attributeValue) return;
    revokeAttribute(address, attributeName, attributeValue);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">
        Attribute Management
      </h2>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="attributeName"
            className="block text-sm font-medium text-gray-700"
          >
            Attribute Name
          </label>
          <select
            id="attributeName"
            value={attributeName}
            onChange={(e) => setAttributeName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={ATTRIBUTE_NAMES.PUBLIC_KEY_ED25519}>
              Public Key (Ed25519)
            </option>
            <option value={ATTRIBUTE_NAMES.PUBLIC_KEY_SECP256K1}>
              Public Key (Secp256k1)
            </option>
            <option value={ATTRIBUTE_NAMES.SERVICE_ENDPOINT}>
              Service Endpoint
            </option>
          </select>
          <p className="mt-1 text-xs text-gray-500 font-mono">
            {attributeName}
          </p>
        </div>

        <div>
          <label
            htmlFor="attributeValue"
            className="block text-sm font-medium text-gray-700"
          >
            Attribute Value
          </label>
          <textarea
            id="attributeValue"
            rows={3}
            placeholder="Enter attribute value (e.g., public key, URL, etc.)"
            value={attributeValue}
            onChange={(e) => setAttributeValue(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="attrValidity"
            className="block text-sm font-medium text-gray-700"
          >
            Validity (days, 0 for permanent)
          </label>
          <input
            id="attrValidity"
            type="number"
            min="0"
            value={validity}
            onChange={(e) => setValidity(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSetAttribute}
            disabled={
              !address || !attributeValue || isSetting || isSetConfirming
            }
            className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isSetting || isSetConfirming ? "Setting..." : "Set Attribute"}
          </button>
          <button
            onClick={handleRevokeAttribute}
            disabled={
              !address || !attributeValue || isRevoking || isRevokeConfirming
            }
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isRevoking || isRevokeConfirming
              ? "Revoking..."
              : "Revoke Attribute"}
          </button>
        </div>

        {setError && (
          <p className="text-sm text-red-600">Set Error: {setError.message}</p>
        )}
        {revokeError && (
          <p className="text-sm text-red-600">
            Revoke Error: {revokeError.message}
          </p>
        )}
        {isSetSuccess && (
          <p className="text-sm text-green-600">
            ✓ Attribute set successfully!
          </p>
        )}
        {isRevokeSuccess && (
          <p className="text-sm text-green-600">
            ✓ Attribute revoked successfully!
          </p>
        )}
      </div>
    </div>
  );
}
