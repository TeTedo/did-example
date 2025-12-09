// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {EthereumDIDRegistry} from "../src/EthereumDIDRegistry.sol";

contract EthereumDIDRegistryTest is Test {
    EthereumDIDRegistry public registry;

    address public identity1;
    address public identity2;
    address public owner1;
    address public owner2;
    address public delegate1;
    address public delegate2;

    uint256 public identity1PrivateKey;
    uint256 public owner1PrivateKey;

    bytes32 constant DELEGATE_TYPE_SIG_AUTH = "sigAuth";
    bytes32 constant DELEGATE_TYPE_VERI_KEY = "veriKey";
    bytes32 constant ATTR_NAME = "did/pub/Ed25519/veriKey/base64";
    bytes constant ATTR_VALUE = "0x1234567890abcdef";

    event DIDOwnerChanged(address indexed identity, address owner, uint256 previousChange);
    event DIDDelegateChanged(
        address indexed identity,
        bytes32 delegateType,
        address delegate,
        uint256 validTo,
        uint256 previousChange
    );
    event DIDAttributeChanged(
        address indexed identity,
        bytes32 name,
        bytes value,
        uint256 validTo,
        uint256 previousChange
    );

    function setUp() public {
        registry = new EthereumDIDRegistry();

        // Create test accounts with private keys for signature testing
        identity1PrivateKey = 0x1;
        identity1 = vm.addr(identity1PrivateKey);

        owner1PrivateKey = 0x2;
        owner1 = vm.addr(owner1PrivateKey);

        identity2 = makeAddr("identity2");
        owner2 = makeAddr("owner2");
        delegate1 = makeAddr("delegate1");
        delegate2 = makeAddr("delegate2");

        vm.deal(identity1, 100 ether);
        vm.deal(owner1, 100 ether);
    }

    // =============================================================
    //                    IDENTITY OWNER TESTS
    // =============================================================

    function test_IdentityOwner_DefaultsToSelf() public view {
        assertEq(registry.identityOwner(identity1), identity1);
        assertEq(registry.identityOwner(identity2), identity2);
    }

    function test_ChangeOwner() public {
        vm.prank(identity1);
        vm.expectEmit(true, false, false, true);
        emit DIDOwnerChanged(identity1, owner1, 0);

        registry.changeOwner(identity1, owner1);

        assertEq(registry.identityOwner(identity1), owner1);
        assertEq(registry.owners(identity1), owner1);
        assertEq(registry.changed(identity1), block.number);
    }

    function test_ChangeOwner_ByNewOwner() public {
        // First transfer
        vm.prank(identity1);
        registry.changeOwner(identity1, owner1);

        // Second transfer by new owner
        vm.prank(owner1);
        registry.changeOwner(identity1, owner2);

        assertEq(registry.identityOwner(identity1), owner2);
    }

    function test_RevertWhen_ChangeOwner_NotOwner() public {
        vm.prank(identity1);
        registry.changeOwner(identity1, owner1);

        // Try to change owner from non-owner account
        vm.prank(identity1);
        vm.expectRevert("ERC1056: bad_actor");
        registry.changeOwner(identity1, owner2);
    }

    function test_ChangeOwnerSigned() public {
        uint256 currentNonce = registry.nonce(identity1);

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(registry),
                currentNonce,
                identity1,
                "changeOwner",
                owner1
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(identity1PrivateKey, hash);

        vm.expectEmit(true, false, false, true);
        emit DIDOwnerChanged(identity1, owner1, 0);

        registry.changeOwnerSigned(identity1, v, r, s, owner1);

        assertEq(registry.identityOwner(identity1), owner1);
        assertEq(registry.nonce(identity1), currentNonce + 1);
    }

    function test_RevertWhen_ChangeOwnerSigned_BadSignature() public {
        uint256 currentNonce = registry.nonce(identity1);

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(registry),
                currentNonce,
                identity1,
                "changeOwner",
                owner1
            )
        );

        // Sign with wrong private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(owner1PrivateKey, hash);

        vm.expectRevert("ERC1056: bad_signature");
        registry.changeOwnerSigned(identity1, v, r, s, owner1);
    }

    // =============================================================
    //                      DELEGATE TESTS
    // =============================================================

    function test_AddDelegate() public {
        uint256 validity = 1 days;
        uint256 expectedValidTo = block.timestamp + validity;

        vm.prank(identity1);
        vm.expectEmit(true, false, false, true);
        emit DIDDelegateChanged(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1, expectedValidTo, 0);

        registry.addDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1, validity);

        assertTrue(registry.validDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1));
        assertEq(registry.changed(identity1), block.number);
    }

    function test_AddDelegate_MultipleTypes() public {
        uint256 validity = 1 days;

        vm.startPrank(identity1);
        registry.addDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1, validity);
        registry.addDelegate(identity1, DELEGATE_TYPE_VERI_KEY, delegate2, validity);
        vm.stopPrank();

        assertTrue(registry.validDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1));
        assertTrue(registry.validDelegate(identity1, DELEGATE_TYPE_VERI_KEY, delegate2));
    }

    function test_ValidDelegate_ExpiredDelegate() public {
        uint256 validity = 1 days;

        vm.prank(identity1);
        registry.addDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1, validity);

        assertTrue(registry.validDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1));

        // Fast forward past expiry
        vm.warp(block.timestamp + validity + 1);

        assertFalse(registry.validDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1));
    }

    function test_RevokeDelegate() public {
        uint256 validity = 1 days;

        vm.startPrank(identity1);
        registry.addDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1, validity);

        assertTrue(registry.validDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1));

        vm.expectEmit(true, false, false, false);
        emit DIDDelegateChanged(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1, block.timestamp, 0);

        registry.revokeDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1);
        vm.stopPrank();

        assertFalse(registry.validDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1));
    }

    function test_RevertWhen_AddDelegate_NotOwner() public {
        vm.prank(owner1);
        vm.expectRevert("ERC1056: bad_actor");
        registry.addDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1, 1 days);
    }

    function test_AddDelegateSigned() public {
        uint256 validity = 1 days;
        uint256 currentNonce = registry.nonce(identity1);

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(registry),
                currentNonce,
                identity1,
                "addDelegate",
                DELEGATE_TYPE_SIG_AUTH,
                delegate1,
                validity
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(identity1PrivateKey, hash);

        registry.addDelegateSigned(identity1, v, r, s, DELEGATE_TYPE_SIG_AUTH, delegate1, validity);

        assertTrue(registry.validDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1));
        assertEq(registry.nonce(identity1), currentNonce + 1);
    }

    function test_RevokeDelegateSigned() public {
        uint256 validity = 1 days;

        vm.prank(identity1);
        registry.addDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1, validity);

        uint256 currentNonce = registry.nonce(identity1);

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(registry),
                currentNonce,
                identity1,
                "revokeDelegate",
                DELEGATE_TYPE_SIG_AUTH,
                delegate1
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(identity1PrivateKey, hash);

        registry.revokeDelegateSigned(identity1, v, r, s, DELEGATE_TYPE_SIG_AUTH, delegate1);

        assertFalse(registry.validDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1));
        assertEq(registry.nonce(identity1), currentNonce + 1);
    }

    // =============================================================
    //                     ATTRIBUTE TESTS
    // =============================================================

    function test_SetAttribute() public {
        uint256 validity = 1 days;
        uint256 expectedValidTo = block.timestamp + validity;

        vm.prank(identity1);
        vm.expectEmit(true, false, false, true);
        emit DIDAttributeChanged(identity1, ATTR_NAME, ATTR_VALUE, expectedValidTo, 0);

        registry.setAttribute(identity1, ATTR_NAME, ATTR_VALUE, validity);

        assertEq(registry.changed(identity1), block.number);
    }

    function test_SetAttribute_Multiple() public {
        uint256 validity = 1 days;
        bytes32 attr2Name = "did/svc/MessagingService";
        bytes memory attr2Value = "https://example.com/messages";

        vm.startPrank(identity1);
        registry.setAttribute(identity1, ATTR_NAME, ATTR_VALUE, validity);
        registry.setAttribute(identity1, attr2Name, attr2Value, validity);
        vm.stopPrank();

        // Both events should have been emitted
        assertEq(registry.changed(identity1), block.number);
    }

    function test_RevokeAttribute() public {
        uint256 validity = 1 days;

        vm.startPrank(identity1);
        registry.setAttribute(identity1, ATTR_NAME, ATTR_VALUE, validity);

        uint256 previousChangeBlock = registry.changed(identity1);

        vm.expectEmit(true, false, false, true);
        emit DIDAttributeChanged(identity1, ATTR_NAME, ATTR_VALUE, 0, previousChangeBlock);

        registry.revokeAttribute(identity1, ATTR_NAME, ATTR_VALUE);
        vm.stopPrank();
    }

    function test_RevertWhen_SetAttribute_NotOwner() public {
        vm.prank(owner1);
        vm.expectRevert("ERC1056: bad_actor");
        registry.setAttribute(identity1, ATTR_NAME, ATTR_VALUE, 1 days);
    }

    function test_SetAttributeSigned() public {
        uint256 validity = 1 days;
        uint256 currentNonce = registry.nonce(identity1);

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(registry),
                currentNonce,
                identity1,
                "setAttribute",
                ATTR_NAME,
                ATTR_VALUE,
                validity
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(identity1PrivateKey, hash);

        registry.setAttributeSigned(identity1, v, r, s, ATTR_NAME, ATTR_VALUE, validity);

        assertEq(registry.nonce(identity1), currentNonce + 1);
    }

    function test_RevokeAttributeSigned() public {
        uint256 validity = 1 days;

        vm.prank(identity1);
        registry.setAttribute(identity1, ATTR_NAME, ATTR_VALUE, validity);

        uint256 currentNonce = registry.nonce(identity1);

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(registry),
                currentNonce,
                identity1,
                "revokeAttribute",
                ATTR_NAME,
                ATTR_VALUE
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(identity1PrivateKey, hash);

        registry.revokeAttributeSigned(identity1, v, r, s, ATTR_NAME, ATTR_VALUE);

        assertEq(registry.nonce(identity1), currentNonce + 1);
    }

    // =============================================================
    //                      INTEGRATION TESTS
    // =============================================================

    function test_CompleteWorkflow() public {
        // 1. Identity starts owning itself
        assertEq(registry.identityOwner(identity1), identity1);

        // 2. Add a delegate
        vm.prank(identity1);
        registry.addDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1, 1 days);
        assertTrue(registry.validDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1));

        // 3. Set an attribute
        vm.prank(identity1);
        registry.setAttribute(identity1, ATTR_NAME, ATTR_VALUE, 1 days);

        // 4. Transfer ownership
        vm.prank(identity1);
        registry.changeOwner(identity1, owner1);
        assertEq(registry.identityOwner(identity1), owner1);

        // 5. New owner can manage identity
        vm.prank(owner1);
        registry.addDelegate(identity1, DELEGATE_TYPE_VERI_KEY, delegate2, 1 days);
        assertTrue(registry.validDelegate(identity1, DELEGATE_TYPE_VERI_KEY, delegate2));

        // 6. Old identity cannot manage anymore
        vm.prank(identity1);
        vm.expectRevert("ERC1056: bad_actor");
        registry.revokeDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1);
    }

    function test_MultipleIdentities() public {
        // Identity1 operations
        vm.prank(identity1);
        registry.changeOwner(identity1, owner1);

        // Identity2 operations
        vm.prank(identity2);
        registry.addDelegate(identity2, DELEGATE_TYPE_SIG_AUTH, delegate1, 1 days);

        // Verify independence
        assertEq(registry.identityOwner(identity1), owner1);
        assertEq(registry.identityOwner(identity2), identity2);
        assertFalse(registry.validDelegate(identity1, DELEGATE_TYPE_SIG_AUTH, delegate1));
        assertTrue(registry.validDelegate(identity2, DELEGATE_TYPE_SIG_AUTH, delegate1));
    }

    // =============================================================
    //                        FUZZ TESTS
    // =============================================================

    function testFuzz_ChangeOwner(address identity, address newOwner) public {
        vm.assume(identity != address(0));
        vm.assume(newOwner != address(0));

        vm.prank(identity);
        registry.changeOwner(identity, newOwner);

        assertEq(registry.identityOwner(identity), newOwner);
    }

    function testFuzz_AddDelegate(address identity, bytes32 delegateType, address delegate, uint256 validity)
        public
    {
        vm.assume(identity != address(0));
        vm.assume(delegate != address(0));
        vm.assume(validity > 0 && validity < 365 days);

        vm.prank(identity);
        registry.addDelegate(identity, delegateType, delegate, validity);

        assertTrue(registry.validDelegate(identity, delegateType, delegate));
    }

    function testFuzz_SetAttribute(address identity, bytes32 name, bytes memory value, uint256 validity)
        public
    {
        vm.assume(identity != address(0));
        vm.assume(validity > 0 && validity < 365 days);
        vm.assume(value.length > 0 && value.length < 1000);

        vm.prank(identity);
        registry.setAttribute(identity, name, value, validity);

        assertEq(registry.changed(identity), block.number);
    }
}
