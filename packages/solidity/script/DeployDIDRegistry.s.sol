// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {EthereumDIDRegistry} from "../src/EthereumDIDRegistry.sol";

/// @title Deploy script for EthereumDIDRegistry
/// @notice Deploys the ERC-1056 compliant Ethereum DID Registry contract
contract DeployEthereumDIDRegistry is Script {
    function run() external returns (EthereumDIDRegistry) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        EthereumDIDRegistry registry = new EthereumDIDRegistry();

        console.log("EthereumDIDRegistry deployed at:", address(registry));

        vm.stopBroadcast();

        return registry;
    }
}
