import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { ERC7984USDC, ERC7984USDC__factory, ERC7984Zama, ERC7984Zama__factory, FHESwap, FHESwap__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

function usdcToZamaOut(usdcIn: bigint): bigint {
  const withFee = (usdcIn * 997n) / 1000n;
  return withFee / 2n;
}

function zamaToUsdcOut(zamaIn: bigint): bigint {
  const withFee = (zamaIn * 997n) / 1000n;
  return withFee * 2n;
}

async function deployFixture() {
  const usdcFactory = (await ethers.getContractFactory("ERC7984USDC")) as ERC7984USDC__factory;
  const zamaFactory = (await ethers.getContractFactory("ERC7984Zama")) as ERC7984Zama__factory;
  const swapFactory = (await ethers.getContractFactory("FHESwap")) as FHESwap__factory;

  const usdc = (await usdcFactory.deploy()) as ERC7984USDC;
  const zama = (await zamaFactory.deploy()) as ERC7984Zama;

  const usdcAddress = await usdc.getAddress();
  const zamaAddress = await zama.getAddress();

  const swap = (await swapFactory.deploy(usdcAddress, zamaAddress)) as FHESwap;
  const swapAddress = await swap.getAddress();

  return { usdc, zama, swap, usdcAddress, zamaAddress, swapAddress };
}

describe("FHESwap", function () {
  let signers: Signers;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }
  });

  it("adds liquidity and swaps both directions", async function () {
    this.timeout(120_000);

    const { usdc, zama, swap, usdcAddress, zamaAddress, swapAddress } = await deployFixture();

    await usdc.mint(signers.alice.address, 50_000);
    await zama.mint(signers.alice.address, 50_000);

    const until = 2 ** 32;
    await usdc.connect(signers.alice).setOperator(swapAddress, until);
    await zama.connect(signers.alice).setOperator(swapAddress, until);

    const usdcLiquidity = 2_000n;
    const zamaLiquidity = 1_000n;

    const liqInput = await fhevm
      .createEncryptedInput(swapAddress, signers.alice.address)
      .add64(usdcLiquidity)
      .add64(zamaLiquidity)
      .encrypt();

    await (await swap.connect(signers.alice).addLiquidity(liqInput.handles[0], liqInput.handles[1], liqInput.inputProof)).wait();

    await swap.allowReserves(signers.alice.address);
    const [encReserveUSDC, encReserveZama] = await swap.getReserves();
    const reserveUSDC = await fhevm.userDecryptEuint(FhevmType.euint64, encReserveUSDC, swapAddress, signers.alice);
    const reserveZama = await fhevm.userDecryptEuint(FhevmType.euint64, encReserveZama, swapAddress, signers.alice);
    expect(BigInt(reserveUSDC)).to.eq(usdcLiquidity);
    expect(BigInt(reserveZama)).to.eq(zamaLiquidity);

    const usdcIn = 100n;
    const swapInput1 = await fhevm
      .createEncryptedInput(swapAddress, signers.alice.address)
      .add64(usdcIn)
      .encrypt();

    const zamaOutTx = await swap.connect(signers.alice).swapUSDCForZama(swapInput1.handles[0], swapInput1.inputProof);
    await zamaOutTx.wait();

    await swap.allowReserves(signers.alice.address);
    const [encReserveUSDC2, encReserveZama2] = await swap.getReserves();
    const reserveUSDC2 = BigInt(
      await fhevm.userDecryptEuint(FhevmType.euint64, encReserveUSDC2, swapAddress, signers.alice),
    );
    const reserveZama2 = BigInt(
      await fhevm.userDecryptEuint(FhevmType.euint64, encReserveZama2, swapAddress, signers.alice),
    );

    const expectedZamaOut = usdcToZamaOut(usdcIn);
    expect(reserveUSDC2).to.eq(usdcLiquidity + usdcIn);
    expect(reserveZama2).to.eq(zamaLiquidity - expectedZamaOut);

    const encAliceZamaBalance = await zama.confidentialBalanceOf(signers.alice.address);
    const aliceZamaBalance = BigInt(
      await fhevm.userDecryptEuint(FhevmType.euint64, encAliceZamaBalance, zamaAddress, signers.alice),
    );
    expect(aliceZamaBalance).to.eq(50_000n - zamaLiquidity + expectedZamaOut);

    const zamaIn = 50n;
    const swapInput2 = await fhevm
      .createEncryptedInput(swapAddress, signers.alice.address)
      .add64(zamaIn)
      .encrypt();

    const usdcOutTx = await swap.connect(signers.alice).swapZamaForUSDC(swapInput2.handles[0], swapInput2.inputProof);
    await usdcOutTx.wait();

    await swap.allowReserves(signers.alice.address);
    const [encReserveUSDC3, encReserveZama3] = await swap.getReserves();
    const reserveUSDC3 = BigInt(
      await fhevm.userDecryptEuint(FhevmType.euint64, encReserveUSDC3, swapAddress, signers.alice),
    );
    const reserveZama3 = BigInt(
      await fhevm.userDecryptEuint(FhevmType.euint64, encReserveZama3, swapAddress, signers.alice),
    );

    const expectedUSDCOut = zamaToUsdcOut(zamaIn);
    expect(reserveZama3).to.eq(reserveZama2 + zamaIn);
    expect(reserveUSDC3).to.eq(reserveUSDC2 - expectedUSDCOut);

    const encAliceUsdcBalance = await usdc.confidentialBalanceOf(signers.alice.address);
    const aliceUsdcBalance = BigInt(
      await fhevm.userDecryptEuint(FhevmType.euint64, encAliceUsdcBalance, usdcAddress, signers.alice),
    );
    expect(aliceUsdcBalance).to.eq(50_000n - usdcLiquidity - usdcIn + expectedUSDCOut);
  });
});
