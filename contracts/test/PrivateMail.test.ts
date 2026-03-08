import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("PrivateMail", function () {
  async function deploy() {
    const [alice, bob] = await ethers.getSigners();
    const PrivateMail = await ethers.getContractFactory("PrivateMail");
    const mail = await PrivateMail.deploy();
    await mail.waitForDeployment();
    return { mail, alice, bob };
  }

  it("should deploy", async function () {
    const { mail } = await deploy();
    expect(await mail.nextMessageId()).to.equal(0n);
  });

  it("should register public key once", async function () {
    const { mail, alice } = await deploy();
    const pubKey = "0x04" + "a".repeat(128);
    await mail.connect(alice).registerPublicKey(pubKey);
    expect(await mail.getPublicKey(alice.address)).to.equal(pubKey);
    expect(await mail.isRegistered(alice.address)).to.be.true;
  });

  it("should revert when already registered", async function () {
    const { mail, alice } = await deploy();
    await mail.connect(alice).registerPublicKey("0x04" + "a".repeat(128));
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

  it("should send message and emit event", async function () {
    const { mail, alice, bob } = await deploy();
    const bobPubKey = "0x04" + "b".repeat(128);
    await mail.connect(bob).registerPublicKey(bobPubKey);

    const ciphertext = "0xdeadbeef";
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("plaintext"));
    const tx = await mail.connect(alice).sendMessage(bob.address, ciphertext, contentHash);
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
    expect(msg.contentHash).to.equal(contentHash);
    expect(msg.timestamp).to.be.gt(0n);
  });

  it("should revert when recipient not registered", async function () {
    const { mail, alice, bob } = await deploy();
    await expect(
      mail.connect(alice).sendMessage(bob.address, "0x11", ethers.ZeroHash)
    ).to.be.revertedWithCustomError(mail, "RecipientNotRegistered");
  });

  it("should revert on empty ciphertext", async function () {
    const { mail, alice, bob } = await deploy();
    await mail.connect(bob).registerPublicKey("0x04" + "b".repeat(128));
    await expect(
      mail.connect(alice).sendMessage(bob.address, "0x", ethers.ZeroHash)
    ).to.be.revertedWithCustomError(mail, "EmptyCiphertext");
  });

  it("should increment message ids", async function () {
    const { mail, alice, bob } = await deploy();
    await mail.connect(bob).registerPublicKey("0x04" + "b".repeat(128));
    await mail.connect(alice).sendMessage(bob.address, "0x01", ethers.ZeroHash);
    await mail.connect(alice).sendMessage(bob.address, "0x02", ethers.ZeroHash);
    expect(await mail.nextMessageId()).to.equal(2n);
    const msg0 = await mail.getMessage(0);
    const msg1 = await mail.getMessage(1);
    expect(msg0.ciphertext).to.equal("0x01");
    expect(msg1.ciphertext).to.equal("0x02");
  });

  it("should revert getMessage for invalid id", async function () {
    const { mail } = await deploy();
    await expect(mail.getMessage(0)).to.be.revertedWithCustomError(mail, "InvalidMessageId");
  });
});
