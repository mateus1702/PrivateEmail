import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

const PUB_KEY = "0x04" + "a".repeat(128);
const PUB_KEY_BOB = "0x04" + "b".repeat(128);

describe("PrivateMail", function () {
  async function deploy() {
    const [alice, bob, carol] = await ethers.getSigners();
    const PrivateMail = await ethers.getContractFactory("PrivateMail");
    const mail = await PrivateMail.deploy();
    await mail.waitForDeployment();
    return { mail, alice, bob, carol };
  }

  describe("deployment", function () {
    it("should deploy with correct initial state", async function () {
      const { mail } = await deploy();
      expect(await mail.nextMessageId()).to.equal(0n);
      expect(await mail.nextPageId()).to.equal(1n);
      expect(await mail.nextCiphertextRefId()).to.equal(1n);
      expect(await mail.CIPHER_TEXT_INLINE_MAX()).to.equal(256n);
      expect(await mail.MESSAGES_PER_PAGE()).to.equal(10n);
    });
  });

  describe("registration", function () {
    it("should register public key once", async function () {
      const { mail, alice } = await deploy();
      await mail.connect(alice).registerPublicKey(PUB_KEY);
      expect(await mail.getPublicKey(alice.address)).to.equal(PUB_KEY);
      expect(await mail.isRegistered(alice.address)).to.be.true;
    });

    it("should revert when already registered", async function () {
      const { mail, alice } = await deploy();
      await mail.connect(alice).registerPublicKey(PUB_KEY);
      await expect(
        mail.connect(alice).registerPublicKey("0x04" + "b".repeat(128))
      ).to.be.revertedWithCustomError(mail, "AlreadyRegistered");
    });

    it("should revert on empty public key", async function () {
      const { mail, alice } = await deploy();
      await expect(mail.connect(alice).registerPublicKey("0x")).to.be.revertedWithCustomError(
        mail,
        "EmptyPublicKey"
      );
    });
  });

  describe("username", function () {
    it("should register username after public key", async function () {
      const { mail, alice } = await deploy();
      await mail.connect(alice).registerPublicKey(PUB_KEY);
      await mail.connect(alice).registerUsername("alice");
      expect(await mail.getAddressForUsername("alice")).to.equal(alice.address);
      expect(await mail.getAddressForUsername("ALICE")).to.equal(alice.address);
      expect(await mail.usernameOf(alice.address)).to.equal("alice");
    });

    it("should revert on username before public key", async function () {
      const { mail, alice } = await deploy();
      await expect(mail.connect(alice).registerUsername("alice")).to.be.revertedWithCustomError(
        mail,
        "NotRegistered"
      );
    });

    it("should revert on duplicate username", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(alice).registerPublicKey(PUB_KEY);
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);
      await mail.connect(alice).registerUsername("alice");
      await expect(mail.connect(bob).registerUsername("alice")).to.be.revertedWithCustomError(
        mail,
        "UsernameTaken"
      );
    });

    it("should revert on invalid username length", async function () {
      const { mail, alice } = await deploy();
      await mail.connect(alice).registerPublicKey(PUB_KEY);
      await expect(mail.connect(alice).registerUsername("ab")).to.be.revertedWithCustomError(
        mail,
        "InvalidUsername"
      );
      await expect(
        mail.connect(alice).registerUsername("a".repeat(33))
      ).to.be.revertedWithCustomError(mail, "InvalidUsername");
    });

    it("should revert when trying to change username", async function () {
      const { mail, alice } = await deploy();
      await mail.connect(alice).registerPublicKey(PUB_KEY);
      await mail.connect(alice).registerUsername("alice");
      await expect(
        mail.connect(alice).registerUsername("alice2")
      ).to.be.revertedWithCustomError(mail, "UsernameAlreadySet");
    });

    it("should accept allowed username chars", async function () {
      const { mail, alice } = await deploy();
      await mail.connect(alice).registerPublicKey(PUB_KEY);
      await mail.connect(alice).registerUsername("alice.mail_user-123");
      expect(await mail.getAddressForUsername("alice.mail_user-123")).to.equal(
        alice.address
      );
    });
  });

  describe("send message", function () {
    it("should send small message (inline ciphertext) and emit event", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);

      const ciphertext = "0xdeadbeef";
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("plaintext"));
      const tx = await mail
        .connect(alice)
        .sendMessage(bob.address, ciphertext, contentHash);
      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      const event = receipt!.logs
        .map((l) => {
          try {
            return mail.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "MessageSent");
      expect(event).to.not.be.undefined;
      expect(event!.args.messageId).to.equal(0n);
      expect(event!.args.sender).to.equal(alice.address);
      expect(event!.args.recipient).to.equal(bob.address);
      expect(event!.args.contentHash).to.equal(contentHash);

      const msg = await mail.getMessage(0);
      expect(msg.sender).to.equal(alice.address);
      expect(msg.recipient).to.equal(bob.address);
      expect(msg.ciphertext).to.equal(ciphertext);
      expect(msg.ciphertextRef).to.equal(0n);
      expect(msg.contentHash).to.equal(contentHash);
      expect(msg.timestamp).to.be.gt(0n);
    });

    it("should send large message (ciphertext by ref)", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);

      const largeCiphertext = "0x" + "ab".repeat(257);
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("long"));
      await mail
        .connect(alice)
        .sendMessage(bob.address, largeCiphertext, contentHash);

      const msg = await mail.getMessage(0);
      expect(msg.ciphertext).to.equal("0x");
      expect(msg.ciphertextRef).to.equal(1n);
      expect(await mail.getLargeCiphertext(1)).to.equal(largeCiphertext);
    });

    it("should revert when recipient not registered", async function () {
      const { mail, alice, bob } = await deploy();
      await expect(
        mail.connect(alice).sendMessage(bob.address, "0x11", ethers.ZeroHash)
      ).to.be.revertedWithCustomError(mail, "RecipientNotRegistered");
    });

    it("should revert on empty ciphertext", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);
      await expect(
        mail.connect(alice).sendMessage(bob.address, "0x", ethers.ZeroHash)
      ).to.be.revertedWithCustomError(mail, "EmptyCiphertext");
    });

    it("should increment message ids", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);
      await mail.connect(alice).sendMessage(bob.address, "0x01", ethers.ZeroHash);
      await mail.connect(alice).sendMessage(bob.address, "0x02", ethers.ZeroHash);
      expect(await mail.nextMessageId()).to.equal(2n);
      const msg0 = await mail.getMessage(0);
      const msg1 = await mail.getMessage(1);
      expect(msg0.ciphertext).to.equal("0x01");
      expect(msg1.ciphertext).to.equal("0x02");
    });
  });

  describe("paging", function () {
    it("should create first page on first message", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);
      await mail.connect(alice).sendMessage(bob.address, "0x01", ethers.ZeroHash);

      const headPageId = await mail.getRecipientHeadPageId(bob.address);
      expect(headPageId).to.equal(1n);

      const [messageIds, count, prevPageId] = await mail.getPage(headPageId);
      expect(count).to.equal(1);
      expect(prevPageId).to.equal(0n);
      expect(messageIds[0]).to.equal(0n);
    });

    it("should append to same page until full (10 messages)", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);

      for (let i = 0; i < 10; i++) {
        const hex = (i + 1).toString(16).padStart(2, "0");
        await mail
          .connect(alice)
          .sendMessage(bob.address, "0x" + hex, ethers.ZeroHash);
      }

      const headPageId = await mail.getRecipientHeadPageId(bob.address);
      expect(headPageId).to.equal(1n);

      const [messageIds, count, prevPageId] = await mail.getPage(headPageId);
      expect(count).to.equal(10);
      expect(prevPageId).to.equal(0n);
      for (let i = 0; i < 10; i++) {
        expect(messageIds[i]).to.equal(BigInt(i));
      }
    });

    it("should create new page when current is full", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);

      for (let i = 0; i < 11; i++) {
        const hex = (i + 1).toString(16).padStart(2, "0");
        await mail
          .connect(alice)
          .sendMessage(bob.address, "0x" + hex, ethers.ZeroHash);
      }

      const headPageId = await mail.getRecipientHeadPageId(bob.address);
      expect(headPageId).to.equal(2n);

      const [messageIds, count, prevPageId] = await mail.getPage(headPageId);
      expect(count).to.equal(1);
      expect(prevPageId).to.equal(1n);
      expect(messageIds[0]).to.equal(10n);

      const [messageIds1, count1, prevPageId1] = await mail.getPage(1n);
      expect(count1).to.equal(10);
      expect(prevPageId1).to.equal(0n);
      for (let i = 0; i < 10; i++) {
        expect(messageIds1[i]).to.equal(BigInt(i));
      }
    });

    it("should support 25 messages across 3 pages", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);

      for (let i = 0; i < 25; i++) {
        const hex = (i + 1).toString(16).padStart(2, "0");
        await mail
          .connect(alice)
          .sendMessage(bob.address, "0x" + hex, ethers.ZeroHash);
      }

      const headPageId = await mail.getRecipientHeadPageId(bob.address);
      expect(headPageId).to.equal(3n);

      let pageId: bigint = headPageId;
      const allIds: bigint[] = [];
      let prevPageId: bigint;

      const [ids3, count3, prev3] = await mail.getPage(3n);
      expect(Number(count3)).to.equal(5);
      expect(prev3).to.equal(2n);
      for (let i = Number(count3) - 1; i >= 0; i--) allIds.push(ids3[i]);

      const [ids2, count2, prev2] = await mail.getPage(2n);
      expect(Number(count2)).to.equal(10);
      expect(prev2).to.equal(1n);
      for (let i = Number(count2) - 1; i >= 0; i--) allIds.push(ids2[i]);

      const [ids1, count1, prev1] = await mail.getPage(1n);
      expect(Number(count1)).to.equal(10);
      expect(prev1).to.equal(0n);
      for (let i = Number(count1) - 1; i >= 0; i--) allIds.push(ids1[i]);

      expect(allIds.length).to.equal(25);
      expect(allIds[0]).to.equal(24n);
      expect(allIds[24]).to.equal(0n);
    });

    it("getPageWithMessages returns full message data", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);
      await mail.connect(alice).sendMessage(bob.address, "0xaa", ethers.ZeroHash);
      await mail.connect(alice).sendMessage(bob.address, "0xbb", ethers.ZeroHash);

      const [count, prevPageId, pageMessages] = await mail.getPageWithMessages(1n);
      expect(count).to.equal(2);
      expect(prevPageId).to.equal(0n);
      expect(pageMessages[0].sender).to.equal(alice.address);
      expect(pageMessages[0].recipient).to.equal(bob.address);
      expect(pageMessages[0].ciphertext).to.equal("0xaa");
      expect(pageMessages[1].ciphertext).to.equal("0xbb");
    });
  });

  describe("invalid inputs", function () {
    it("should revert getMessage for invalid id", async function () {
      const { mail } = await deploy();
      await expect(mail.getMessage(0)).to.be.revertedWithCustomError(
        mail,
        "InvalidMessageId"
      );
    });

    it("should revert getPage for invalid pageId", async function () {
      const { mail } = await deploy();
      await expect(mail.getPage(0)).to.be.revertedWithCustomError(
        mail,
        "InvalidPageId"
      );
      await expect(mail.getPage(1)).to.be.revertedWithCustomError(
        mail,
        "InvalidPageId"
      );
    });

    it("should revert getPageWithMessages for invalid pageId", async function () {
      const { mail } = await deploy();
      await expect(mail.getPageWithMessages(0)).to.be.revertedWithCustomError(
        mail,
        "InvalidPageId"
      );
    });
  });

  describe("gas", function () {
    it("sendMessage inline (append to page) gas", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);
      const small = "0x" + "11".repeat(32);
      const tx = await mail
        .connect(alice)
        .sendMessage(bob.address, small, ethers.ZeroHash);
      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;
      const gasUsed = receipt!.gasUsed;
      expect(gasUsed).to.be.lt(250000n);
    });

    it("sendMessage inline (new page) gas", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);
      for (let i = 0; i < 10; i++) {
        const hex = (i + 1).toString(16).padStart(2, "0");
        await mail
          .connect(alice)
          .sendMessage(bob.address, "0x" + hex, ethers.ZeroHash);
      }
      const tx = await mail
        .connect(alice)
        .sendMessage(bob.address, "0x0b", ethers.ZeroHash);
      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;
      const gasUsed = receipt!.gasUsed;
      expect(gasUsed).to.be.lt(300000n);
    });

    it("sendMessage large (ref) gas", async function () {
      const { mail, alice, bob } = await deploy();
      await mail.connect(bob).registerPublicKey(PUB_KEY_BOB);
      const large = "0x" + "ab".repeat(300);
      const tx = await mail
        .connect(alice)
        .sendMessage(bob.address, large, ethers.ZeroHash);
      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;
      const gasUsed = receipt!.gasUsed;
      expect(gasUsed).to.be.lt(500000n);
    });
  });
});
