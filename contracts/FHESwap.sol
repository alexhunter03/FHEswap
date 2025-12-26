// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHESwap is ZamaEthereumConfig {
    address public immutable fUSDC;
    address public immutable fZama;

    euint64 private _reserveUSDC;
    euint64 private _reserveZama;

    event LiquidityAdded(address indexed provider, euint64 usdcIn, euint64 zamaIn);
    event Swap(address indexed trader, address indexed tokenIn, address indexed tokenOut, euint64 amountIn, euint64 amountOut);

    error InvalidToken(address token);

    constructor(address fUSDC_, address fZama_) {
        if (fUSDC_ == address(0)) revert InvalidToken(fUSDC_);
        if (fZama_ == address(0)) revert InvalidToken(fZama_);

        fUSDC = fUSDC_;
        fZama = fZama_;
    }

    function getReserves() external view returns (euint64 reserveUSDC, euint64 reserveZama) {
        return (_reserveUSDC, _reserveZama);
    }

    function allowReserves(address user) external {
        FHE.allow(_reserveUSDC, user);
        FHE.allow(_reserveZama, user);
    }

    function addLiquidity(
        externalEuint64 usdcAmountExt,
        externalEuint64 zamaAmountExt,
        bytes calldata inputProof
    ) external returns (euint64 usdcIn, euint64 zamaIn) {
        usdcIn = FHE.fromExternal(usdcAmountExt, inputProof);
        zamaIn = FHE.fromExternal(zamaAmountExt, inputProof);

        FHE.allow(usdcIn, fUSDC);
        FHE.allow(zamaIn, fZama);

        euint64 usdcTransferred = IERC7984(fUSDC).confidentialTransferFrom(msg.sender, address(this), usdcIn);
        euint64 zamaTransferred = IERC7984(fZama).confidentialTransferFrom(msg.sender, address(this), zamaIn);

        _reserveUSDC = FHE.add(_reserveUSDC, usdcTransferred);
        _reserveZama = FHE.add(_reserveZama, zamaTransferred);

        FHE.allowThis(_reserveUSDC);
        FHE.allowThis(_reserveZama);

        FHE.allow(usdcTransferred, msg.sender);
        FHE.allow(zamaTransferred, msg.sender);

        emit LiquidityAdded(msg.sender, usdcTransferred, zamaTransferred);
        return (usdcTransferred, zamaTransferred);
    }

    function swapUSDCForZama(
        externalEuint64 usdcAmountInExt,
        bytes calldata inputProof
    ) external returns (euint64 zamaOut) {
        euint64 usdcAmountIn = FHE.fromExternal(usdcAmountInExt, inputProof);
        FHE.allow(usdcAmountIn, fUSDC);

        euint64 usdcTransferred = IERC7984(fUSDC).confidentialTransferFrom(msg.sender, address(this), usdcAmountIn);

        euint64 expectedOut = _capOutput(_usdcToZamaOut(usdcTransferred), _reserveZama);
        FHE.allow(expectedOut, fZama);

        euint64 zamaTransferredOut = IERC7984(fZama).confidentialTransfer(msg.sender, expectedOut);

        _reserveUSDC = FHE.add(_reserveUSDC, usdcTransferred);
        _reserveZama = FHE.sub(_reserveZama, zamaTransferredOut);

        FHE.allowThis(_reserveUSDC);
        FHE.allowThis(_reserveZama);

        FHE.allow(usdcTransferred, msg.sender);
        FHE.allow(zamaTransferredOut, msg.sender);

        emit Swap(msg.sender, fUSDC, fZama, usdcTransferred, zamaTransferredOut);
        return zamaTransferredOut;
    }

    function swapZamaForUSDC(
        externalEuint64 zamaAmountInExt,
        bytes calldata inputProof
    ) external returns (euint64 usdcOut) {
        euint64 zamaAmountIn = FHE.fromExternal(zamaAmountInExt, inputProof);
        FHE.allow(zamaAmountIn, fZama);

        euint64 zamaTransferred = IERC7984(fZama).confidentialTransferFrom(msg.sender, address(this), zamaAmountIn);

        euint64 expectedOut = _capOutput(_zamaToUsdcOut(zamaTransferred), _reserveUSDC);
        FHE.allow(expectedOut, fUSDC);

        euint64 usdcTransferredOut = IERC7984(fUSDC).confidentialTransfer(msg.sender, expectedOut);

        _reserveZama = FHE.add(_reserveZama, zamaTransferred);
        _reserveUSDC = FHE.sub(_reserveUSDC, usdcTransferredOut);

        FHE.allowThis(_reserveUSDC);
        FHE.allowThis(_reserveZama);

        FHE.allow(zamaTransferred, msg.sender);
        FHE.allow(usdcTransferredOut, msg.sender);

        emit Swap(msg.sender, fZama, fUSDC, zamaTransferred, usdcTransferredOut);
        return usdcTransferredOut;
    }

    function _applyFee(euint64 amountIn) internal returns (euint64) {
        return FHE.div(FHE.mul(amountIn, uint64(997)), uint64(1000));
    }

    function _usdcToZamaOut(euint64 usdcIn) internal returns (euint64) {
        return FHE.div(_applyFee(usdcIn), uint64(2));
    }

    function _zamaToUsdcOut(euint64 zamaIn) internal returns (euint64) {
        return FHE.mul(_applyFee(zamaIn), uint64(2));
    }

    function _capOutput(euint64 amountOut, euint64 reserveOut) internal returns (euint64) {
        ebool takeReserve = FHE.lt(reserveOut, amountOut);
        return FHE.select(takeReserve, reserveOut, amountOut);
    }
}
