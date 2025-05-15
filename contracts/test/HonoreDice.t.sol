// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {HonoreDice} from "../src/HonoreDice.sol";

contract HonoreDiceTest is Test {
    HonoreDice public honoreDice;

    function setUp() public {
        honoreDice = new HonoreDice();
    }
}
