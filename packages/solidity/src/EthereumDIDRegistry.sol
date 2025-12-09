// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title EthereumDIDRegistry
/// @notice ERC-1056 compliant registry for Ethereum-based Decentralized Identifiers (DIDs)
/// @dev Implements lightweight identity management with owner control, delegates, and attributes
/// @custom:security-contact security@example.com
contract EthereumDIDRegistry {
    // =============================================================
    //                           STORAGE
    // =============================================================

    /// @notice Mapping from identity address to current owner address
    /// @dev If not set (address(0)), the identity owns itself
    mapping(address => address) public owners;

    /// @notice Mapping from identity to delegate type to delegate address to validity timestamp
    /// @dev delegates[identity][keccak256(delegateType)][delegate] = validUntil
    mapping(address => mapping(bytes32 => mapping(address => uint256))) public delegates;

    /// @notice Block number when the identity was last changed
    /// @dev Used for tracking change history off-chain
    mapping(address => uint256) public changed;

    /// @notice Nonce for each identity owner for replay protection
    /// @dev Incremented with each signed transaction
    mapping(address => uint256) public nonce;

    // =============================================================
    //                           EVENTS
    // =============================================================

    /// @notice Emitted when an identity owner is changed
    /// @param identity The identity whose owner changed
    /// @param owner The new owner address
    /// @param previousChange The block number of the previous change
    event DIDOwnerChanged(address indexed identity, address owner, uint256 previousChange);

    /// @notice Emitted when a delegate is added or revoked
    /// @param identity The identity that changed delegates
    /// @param delegateType The type of delegate (e.g., "sigAuth", "veriKey")
    /// @param delegate The delegate address
    /// @param validTo Timestamp until which the delegate is valid (0 for revoked)
    /// @param previousChange The block number of the previous change
    event DIDDelegateChanged(
        address indexed identity,
        bytes32 delegateType,
        address delegate,
        uint256 validTo,
        uint256 previousChange
    );

    /// @notice Emitted when an attribute is set or revoked
    /// @param identity The identity that changed attributes
    /// @param name The attribute name (e.g., "did/pub/Ed25519/veriKey/base64")
    /// @param value The attribute value
    /// @param validTo Timestamp until which the attribute is valid (0 for revoked)
    /// @param previousChange The block number of the previous change
    event DIDAttributeChanged(
        address indexed identity,
        bytes32 name,
        bytes value,
        uint256 validTo,
        uint256 previousChange
    );

    // =============================================================
    //                          MODIFIERS
    // =============================================================

    /// @notice Ensures the actor is the owner of the identity
    /// @param identity The identity to check ownership for
    /// @param actor The address attempting to act on behalf of the identity
    modifier onlyOwner(address identity, address actor) {
        require(actor == identityOwner(identity), "ERC1056: bad_actor");
        _;
    }

    // =============================================================
    //                        VIEW FUNCTIONS
    // =============================================================

    /// @notice Returns the current owner of an identity
    /// @dev If no owner is set, the identity owns itself
    /// @param identity The identity to query
    /// @return The owner address
    function identityOwner(address identity) public view returns (address) {
        address owner = owners[identity];
        if (owner != address(0)) {
            return owner;
        }
        return identity;
    }

    /// @notice Checks if a delegate is currently valid for an identity
    /// @param identity The identity to check
    /// @param delegateType The type of delegate
    /// @param delegate The delegate address
    /// @return True if the delegate is valid (not expired)
    function validDelegate(address identity, bytes32 delegateType, address delegate)
        public
        view
        returns (bool)
    {
        uint256 validity = delegates[identity][keccak256(abi.encode(delegateType))][delegate];
        return validity > block.timestamp;
    }

    // =============================================================
    //                    OWNER MANAGEMENT
    // =============================================================

    /// @notice Internal function to change the owner of an identity
    /// @param identity The identity whose owner to change
    /// @param actor The address performing the change (must be current owner)
    /// @param newOwner The new owner address
    function changeOwner(address identity, address actor, address newOwner)
        internal
        onlyOwner(identity, actor)
    {
        owners[identity] = newOwner;
        emit DIDOwnerChanged(identity, newOwner, changed[identity]);
        changed[identity] = block.number;
    }

    /// @notice Change the owner of an identity
    /// @param identity The identity whose owner to change
    /// @param newOwner The new owner address
    function changeOwner(address identity, address newOwner) public {
        changeOwner(identity, msg.sender, newOwner);
    }

    /// @notice Change owner using a signed message (meta-transaction)
    /// @param identity The identity whose owner to change
    /// @param sigV ECDSA signature V component
    /// @param sigR ECDSA signature R component
    /// @param sigS ECDSA signature S component
    /// @param newOwner The new owner address
    function changeOwnerSigned(
        address identity,
        uint8 sigV,
        bytes32 sigR,
        bytes32 sigS,
        address newOwner
    ) public {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(this),
                nonce[identityOwner(identity)],
                identity,
                "changeOwner",
                newOwner
            )
        );
        changeOwner(identity, checkSignature(identity, sigV, sigR, sigS, hash), newOwner);
    }

    // =============================================================
    //                   DELEGATE MANAGEMENT
    // =============================================================

    /// @notice Internal function to add a delegate
    /// @param identity The identity to add a delegate for
    /// @param actor The address performing the action (must be owner)
    /// @param delegateType The type of delegate (e.g., "sigAuth")
    /// @param delegate The delegate address
    /// @param validity Duration in seconds for which the delegate is valid
    function addDelegate(
        address identity,
        address actor,
        bytes32 delegateType,
        address delegate,
        uint256 validity
    ) internal onlyOwner(identity, actor) {
        bytes32 delegateTypeHash = keccak256(abi.encode(delegateType));
        delegates[identity][delegateTypeHash][delegate] = block.timestamp + validity;
        emit DIDDelegateChanged(
            identity, delegateType, delegate, block.timestamp + validity, changed[identity]
        );
        changed[identity] = block.number;
    }

    /// @notice Add a delegate to an identity
    /// @param identity The identity to add a delegate for
    /// @param delegateType The type of delegate
    /// @param delegate The delegate address
    /// @param validity Duration in seconds for which the delegate is valid
    function addDelegate(address identity, bytes32 delegateType, address delegate, uint256 validity)
        public
    {
        addDelegate(identity, msg.sender, delegateType, delegate, validity);
    }

    /// @notice Add a delegate using a signed message (meta-transaction)
    /// @param identity The identity to add a delegate for
    /// @param sigV ECDSA signature V component
    /// @param sigR ECDSA signature R component
    /// @param sigS ECDSA signature S component
    /// @param delegateType The type of delegate
    /// @param delegate The delegate address
    /// @param validity Duration in seconds for which the delegate is valid
    function addDelegateSigned(
        address identity,
        uint8 sigV,
        bytes32 sigR,
        bytes32 sigS,
        bytes32 delegateType,
        address delegate,
        uint256 validity
    ) public {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(this),
                nonce[identityOwner(identity)],
                identity,
                "addDelegate",
                delegateType,
                delegate,
                validity
            )
        );
        addDelegate(
            identity, checkSignature(identity, sigV, sigR, sigS, hash), delegateType, delegate, validity
        );
    }

    /// @notice Internal function to revoke a delegate
    /// @param identity The identity to revoke a delegate from
    /// @param actor The address performing the action (must be owner)
    /// @param delegateType The type of delegate
    /// @param delegate The delegate address to revoke
    function revokeDelegate(address identity, address actor, bytes32 delegateType, address delegate)
        internal
        onlyOwner(identity, actor)
    {
        bytes32 delegateTypeHash = keccak256(abi.encode(delegateType));
        delegates[identity][delegateTypeHash][delegate] = block.timestamp;
        emit DIDDelegateChanged(identity, delegateType, delegate, block.timestamp, changed[identity]);
        changed[identity] = block.number;
    }

    /// @notice Revoke a delegate from an identity
    /// @param identity The identity to revoke a delegate from
    /// @param delegateType The type of delegate
    /// @param delegate The delegate address to revoke
    function revokeDelegate(address identity, bytes32 delegateType, address delegate) public {
        revokeDelegate(identity, msg.sender, delegateType, delegate);
    }

    /// @notice Revoke a delegate using a signed message (meta-transaction)
    /// @param identity The identity to revoke a delegate from
    /// @param sigV ECDSA signature V component
    /// @param sigR ECDSA signature R component
    /// @param sigS ECDSA signature S component
    /// @param delegateType The type of delegate
    /// @param delegate The delegate address to revoke
    function revokeDelegateSigned(
        address identity,
        uint8 sigV,
        bytes32 sigR,
        bytes32 sigS,
        bytes32 delegateType,
        address delegate
    ) public {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(this),
                nonce[identityOwner(identity)],
                identity,
                "revokeDelegate",
                delegateType,
                delegate
            )
        );
        revokeDelegate(identity, checkSignature(identity, sigV, sigR, sigS, hash), delegateType, delegate);
    }

    // =============================================================
    //                  ATTRIBUTE MANAGEMENT
    // =============================================================

    /// @notice Internal function to set an attribute
    /// @param identity The identity to set an attribute for
    /// @param actor The address performing the action (must be owner)
    /// @param name The attribute name
    /// @param value The attribute value
    /// @param validity Duration in seconds for which the attribute is valid
    function setAttribute(
        address identity,
        address actor,
        bytes32 name,
        bytes memory value,
        uint256 validity
    ) internal onlyOwner(identity, actor) {
        emit DIDAttributeChanged(identity, name, value, block.timestamp + validity, changed[identity]);
        changed[identity] = block.number;
    }

    /// @notice Set an attribute for an identity
    /// @param identity The identity to set an attribute for
    /// @param name The attribute name
    /// @param value The attribute value
    /// @param validity Duration in seconds for which the attribute is valid
    function setAttribute(address identity, bytes32 name, bytes memory value, uint256 validity)
        public
    {
        setAttribute(identity, msg.sender, name, value, validity);
    }

    /// @notice Set an attribute using a signed message (meta-transaction)
    /// @param identity The identity to set an attribute for
    /// @param sigV ECDSA signature V component
    /// @param sigR ECDSA signature R component
    /// @param sigS ECDSA signature S component
    /// @param name The attribute name
    /// @param value The attribute value
    /// @param validity Duration in seconds for which the attribute is valid
    function setAttributeSigned(
        address identity,
        uint8 sigV,
        bytes32 sigR,
        bytes32 sigS,
        bytes32 name,
        bytes memory value,
        uint256 validity
    ) public {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(this),
                nonce[identityOwner(identity)],
                identity,
                "setAttribute",
                name,
                value,
                validity
            )
        );
        setAttribute(identity, checkSignature(identity, sigV, sigR, sigS, hash), name, value, validity);
    }

    /// @notice Internal function to revoke an attribute
    /// @param identity The identity to revoke an attribute from
    /// @param actor The address performing the action (must be owner)
    /// @param name The attribute name
    /// @param value The attribute value
    function revokeAttribute(address identity, address actor, bytes32 name, bytes memory value)
        internal
        onlyOwner(identity, actor)
    {
        emit DIDAttributeChanged(identity, name, value, 0, changed[identity]);
        changed[identity] = block.number;
    }

    /// @notice Revoke an attribute from an identity
    /// @param identity The identity to revoke an attribute from
    /// @param name The attribute name
    /// @param value The attribute value
    function revokeAttribute(address identity, bytes32 name, bytes memory value) public {
        revokeAttribute(identity, msg.sender, name, value);
    }

    /// @notice Revoke an attribute using a signed message (meta-transaction)
    /// @param identity The identity to revoke an attribute from
    /// @param sigV ECDSA signature V component
    /// @param sigR ECDSA signature R component
    /// @param sigS ECDSA signature S component
    /// @param name The attribute name
    /// @param value The attribute value
    function revokeAttributeSigned(
        address identity,
        uint8 sigV,
        bytes32 sigR,
        bytes32 sigS,
        bytes32 name,
        bytes memory value
    ) public {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x00),
                address(this),
                nonce[identityOwner(identity)],
                identity,
                "revokeAttribute",
                name,
                value
            )
        );
        revokeAttribute(identity, checkSignature(identity, sigV, sigR, sigS, hash), name, value);
    }

    // =============================================================
    //                    SIGNATURE VERIFICATION
    // =============================================================

    /// @notice Verifies a signature and returns the signer
    /// @dev Uses EIP-191 signature verification and increments nonce
    /// @param identity The identity on whose behalf the signature was made
    /// @param sigV ECDSA signature V component
    /// @param sigR ECDSA signature R component
    /// @param sigS ECDSA signature S component
    /// @param hash The hash that was signed
    /// @return The address that signed the message
    function checkSignature(address identity, uint8 sigV, bytes32 sigR, bytes32 sigS, bytes32 hash)
        internal
        returns (address)
    {
        address signer = ecrecover(hash, sigV, sigR, sigS);
        require(signer == identityOwner(identity), "ERC1056: bad_signature");
        nonce[signer]++;
        return signer;
    }
}
