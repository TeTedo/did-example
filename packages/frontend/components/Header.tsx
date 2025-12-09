"use client";

import { useEffect, useMemo } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { localChain } from "@/lib/wagmi";

export function Header() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  // Find MetaMask or any injected wallet connector
  const injectedConnector = useMemo(() => {
    return connectors.find(
      (c) => c.id === "injected" || c.name.toLowerCase().includes("metamask")
    );
  }, [connectors]);

  useEffect(() => {
    if (isConnected && chainId !== localChain.id) {
      switchChain({ chainId: localChain.id });
    }
  }, [isConnected, chainId, switchChain]);

  const handleConnect = () => {
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    } else if (connectors.length > 0) {
      connect({ connector: connectors[0] });
    }
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Ethereum DID Registry
            </h1>
            <p className="text-sm text-gray-600">
              ERC-1056 Decentralized Identity Management
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Chain indicator */}
            {isConnected && (
              <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-green-700">
                  {chainId === localChain.id ? "Localhost" : `Chain ${chainId}`}
                </span>
              </div>
            )}

            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </p>
                  <p className="text-xs text-gray-500">Connected</p>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={!injectedConnector && connectors.length === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {injectedConnector ? "Connect MetaMask" : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
