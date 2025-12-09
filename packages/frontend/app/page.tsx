"use client";

import { Header } from "@/components/Header";
import { IdentityManager } from "@/components/IdentityManager";
import { DelegateManager } from "@/components/DelegateManager";
import { AttributeManager } from "@/components/AttributeManager";
import { EventDashboard } from "@/components/EventDashboard";
import { CredentialManager } from "@/components/CredentialManager";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">
              Welcome to Ethereum DID Registry
            </h2>
            <p className="mb-6 text-gray-600">
              Connect your wallet to manage your decentralized identity
            </p>
            <div className="space-y-4 text-left max-w-2xl mx-auto">
              <div className="rounded-lg bg-blue-50 p-4">
                <h3 className="font-medium text-blue-900 mb-2">
                  🔑 Identity Ownership
                </h3>
                <p className="text-sm text-blue-800">
                  Every Ethereum address is a valid identity. Transfer ownership
                  to new keys or multisig contracts.
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-4">
                <h3 className="font-medium text-green-900 mb-2">
                  👥 Delegates
                </h3>
                <p className="text-sm text-green-800">
                  Grant temporary authorization to other addresses for specific
                  operations with automatic expiry.
                </p>
              </div>
              <div className="rounded-lg bg-purple-50 p-4">
                <h3 className="font-medium text-purple-900 mb-2">
                  📝 Attributes
                </h3>
                <p className="text-sm text-purple-800">
                  Store public keys, service endpoints, and other DID document
                  data on-chain.
                </p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-4">
                <h3 className="font-medium text-yellow-900 mb-2">
                  🎓 Verifiable Credentials
                </h3>
                <p className="text-sm text-yellow-800">
                  Issue and verify credentials like degrees, certifications, and
                  memberships using your DID.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Event Dashboard */}
            <EventDashboard />

            {/* DID Management */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <IdentityManager />
                <DelegateManager />
              </div>
              <div className="space-y-6">
                <AttributeManager />
              </div>
            </div>

            {/* Credential Management */}
            <CredentialManager />
          </div>
        )}

        {isConnected && (
          <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="font-medium text-blue-900 mb-2">
              ℹ️ About ERC-1056 & Verifiable Credentials
            </h3>
            <p className="text-sm text-blue-800">
              This application interacts with an ERC-1056 compliant Ethereum DID
              Registry contract. You can also issue and verify W3C Verifiable
              Credentials. Learn more at{" "}
              <a
                href="https://eips.ethereum.org/EIPS/eip-1056"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-900"
              >
                EIP-1056
              </a>{" "}
              and{" "}
              <a
                href="https://www.w3.org/TR/vc-data-model/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-900"
              >
                W3C VC Data Model
              </a>
              .
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
