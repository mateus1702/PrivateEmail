// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PrivateMail
 * @notice On-chain registry for encryption public keys and encrypted message storage.
 * @dev Recipients register public keys; senders encrypt and store ciphertext. Metadata visible on-chain.
 */
contract PrivateMail {
    error ZeroAddress();
    error EmptyPublicKey();
    error AlreadyRegistered(address owner);
    error EmptyCiphertext();
    error RecipientNotRegistered(address recipient);
    error InvalidMessageId(uint256 messageId);

    struct Message {
        address sender;
        address recipient;
        bytes ciphertext;
        uint256 timestamp;
        bytes32 contentHash;
    }

    uint256 public nextMessageId;
    mapping(uint256 => Message) public messages;
    mapping(address => bytes) public encryptionPublicKeys;
    mapping(address => bool) public hasRegisteredKey;

    event PublicKeyRegistered(address indexed owner, bytes pubKey);
    event MessageSent(
        uint256 indexed messageId,
        address indexed sender,
        address indexed recipient,
        uint256 timestamp,
        bytes32 contentHash
    );

    /**
     * @notice Register the caller's encryption public key. One-time only; key is deterministic from identity.
     * @param pubKey Raw public key bytes (e.g. X25519 or uncompressed secp256k1).
     */
    function registerPublicKey(bytes calldata pubKey) external {
        if (msg.sender == address(0)) revert ZeroAddress();
        if (pubKey.length == 0) revert EmptyPublicKey();
        if (hasRegisteredKey[msg.sender]) revert AlreadyRegistered(msg.sender);
        encryptionPublicKeys[msg.sender] = pubKey;
        hasRegisteredKey[msg.sender] = true;
        emit PublicKeyRegistered(msg.sender, pubKey);
    }

    /**
     * @notice Send an encrypted message to a recipient.
     * @param recipient Recipient address (must have registered a public key).
     * @param ciphertext Encrypted message payload.
     * @param contentHash Keccak256 of plaintext for integrity verification.
     * @return messageId Assigned message ID for retrieval.
     */
    function sendMessage(
        address recipient,
        bytes calldata ciphertext,
        bytes32 contentHash
    ) external returns (uint256 messageId) {
        if (recipient == address(0)) revert ZeroAddress();
        if (!hasRegisteredKey[recipient]) revert RecipientNotRegistered(recipient);
        if (ciphertext.length == 0) revert EmptyCiphertext();

        messageId = nextMessageId++;
        messages[messageId] = Message({
            sender: msg.sender,
            recipient: recipient,
            ciphertext: ciphertext,
            timestamp: block.timestamp,
            contentHash: contentHash
        });

        emit MessageSent(messageId, msg.sender, recipient, block.timestamp, contentHash);
        return messageId;
    }

    /**
     * @notice Fetch a message by ID.
     */
    function getMessage(uint256 messageId) external view returns (Message memory) {
        if (messageId >= nextMessageId) revert InvalidMessageId(messageId);
        return messages[messageId];
    }

    /**
     * @notice Get the encryption public key for an address.
     */
    function getPublicKey(address owner) external view returns (bytes memory) {
        return encryptionPublicKeys[owner];
    }

    /**
     * @notice Check if an address has registered a public key.
     */
    function isRegistered(address owner) external view returns (bool) {
        return hasRegisteredKey[owner];
    }
}
